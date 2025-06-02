import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Download, UploadCloud, Settings, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

// Helper to create a downloadable blob
const createDownloadBlob = (content, filename, contentType = 'text/plain') => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Main App Component
const App = () => {
  const [metadata, setMetadata] = useState({
    appName: 'MyConsoleApp',
    version: '1.0.0.0',
    company: 'My Company',
    product: 'My Product Installer',
    copyright: `Copyright © ${new Date().getFullYear()} My Company`,
    trademark: 'My Trademark',
    description: 'A console application.',
    targetRuntime: 'win-x64', // Default to Windows executable
  });

  const [baselineDateInput, setBaselineDateInput] = useState('MAY25');

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const productFamilyOptions = {
    'Host (CoreStation)': ['RX360','CX6620','HX2000'],
    'Client (DX)': ['5th Gen (vPro)', '5th Gen (non-vPro)', 'DX1600'],
  };
  const defaultFamily = 'Host (CoreStation)';
  const [selectedFamily, setSelectedFamily] = useState(defaultFamily);
  const [selectedProduct, setSelectedProduct] = useState(productFamilyOptions[defaultFamily][2]);

  const [driverFile, setDriverFile] = useState(null);
  const [driverFileName, setDriverFileName] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState([]);
  const [buildError, setBuildError] = useState('');
  const [buildSuccess, setBuildSuccess] = useState('');

  const [downloadLinkInfo, setDownloadLinkInfo] = useState(null);

  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      const { scrollHeight, clientHeight } = logContainerRef.current;
      logContainerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  }, [buildLog]);

  useEffect(() => {
    setSelectedProduct(productFamilyOptions[selectedFamily][0]);
  }, [selectedFamily]);

  const handleFamilyChange = (e) => {
    setSelectedFamily(e.target.value);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.name.endsWith('.zip')) {
        setDriverFile(file);
        setDriverFileName(file.name);
        addLog(`Selected driver file: ${file.name}`);
        setBuildError('');
      } else {
        setDriverFile(null);
        setDriverFileName('');
        addLog('Invalid file type. Please upload a .zip file.', 'error');
        setBuildError('Invalid file type. Please upload a .zip file.');
      }
    }
  };

  const addLog = (message, type = 'info') => {
    setBuildLog(prev => [...prev, { text: message, type, timestamp: new Date().toISOString() }]);
  };

  const processFile = (file) => {
    if (file) {
      if (file.name.endsWith('.zip')) {
        setDriverFile(file);
        setDriverFileName(file.name);
        addLog(`Selected driver file: ${file.name}`);
        setBuildError('');
      } else {
        setDriverFile(null);
        setDriverFileName('');
        const errorMsg = 'Invalid file type. Please upload or drop a .zip file.';
        addLog(errorMsg, 'error');
        setBuildError(errorMsg);
      }
    }
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [addLog, processFile]);

  const handleActualBuild = useCallback(async () => {
  	setIsBuilding(true);
        setBuildLog([]);
        setBuildError('');
        setBuildSuccess('');
        setDownloadLinkInfo(null);
        addLog('Build process initiated with backend...');

        if (!driverFile) {
            addLog('Error: Driver ZIP file is required.', 'error');
            setBuildError('Driver ZIP file is required.');
            setIsBuilding(false);
            return;
        }

        const formData = new FormData();
        formData.append('driverFile', driverFile);
        // Append metadata fields (ensure names match backend req.body expectations)
        Object.keys(metadata).forEach(key => {
            formData.append(key, metadata[key]);
        });

        formData.append('selectedFamily', selectedFamily);
        formData.append('selectedProduct', selectedProduct);
        formData.append('baselineDateInput', baselineDateInput);

        try {
            const response = await axios.post('http://10.50.0.107:3001/build', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    addLog(`Uploading driver: ${percentCompleted}%`);
                }
            });

            addLog('Backend processing complete.');
            if (response.data.log) {
                response.data.log.split('\n').forEach(line => addLog(line, 'backend'));
            }
            if (response.data.errorLog) {
                response.data.errorLog.split('\n').forEach(line => addLog(line, 'error'));
            }

            if (response.status === 200 && response.data.downloadInfo) {
                const { buildDir, fileName } = response.data.downloadInfo;
		const downloadUrl = `http://10.50.0.107:3001/download/${encodeURIComponent(buildDir)}/${encodeURIComponent(fileName)}`;		

                addLog(`Build successful! Output: '${fileName}' is ready.`, 'success');
                setBuildSuccess(response.data.message || 'Build completed successfully.');
		setDownloadLinkInfo({ url: downloadUrl, name: fileName });

            } else {
                throw new Error(response.data.message || 'Build failed or output not found.');
		addLog(errorMsg, 'error');
		setBuildError(errorMsg);
            }

        } catch (error) {
            console.error('Build error:', error);
            addLog(`Error during build: ${error.response?.data?.message || error.message}`, 'error');
            if (error.response?.data?.log) {
                 error.response.data.log.split('\n').forEach(line => addLog(line, 'backend'));
            }
            if (error.response?.data?.errorLog) {
                 error.response.data.errorLog.split('\n').forEach(line => addLog(line, 'error'));
            }
            setBuildError(error.response?.data?.message || error.message || 'An unknown error occurred.');
        } finally {
            setIsBuilding(false);
        }
    }, [driverFile, metadata, selectedFamily, selectedProduct, baselineDateInput, addLog]);
  // Style definitions
  const inputClass = "w-full p-3 bg-slate-700 text-slate-100 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors placeholder-slate-400";
  // UPDATED LABEL CLASS:
  const labelClass = "block text-sm font-medium text-slate-300 mb-1"; // Changed text-gray-700 to text-slate-300

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-gray-100 font-sans p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-slate-800 shadow-2xl rounded-xl p-6 sm:p-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 flex items-center justify-center">
            <Package size={40} className="mr-3" /> CI Build Customizer
          </h1>
          <p className="text-slate-400 mt-2">Define application metadata, upload drivers, and get your self-contained executable.</p>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); handleActualBuild(); }} className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-sky-400 border-b-2 border-sky-500 pb-2 mb-6 flex items-center">
              <Settings size={24} className="mr-2" /> Application Metadata
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="appName" className={labelClass}>Application Name</label>
                <input type="text" name="appName" id="appName" value={metadata.appName} onChange={handleInputChange} className={inputClass} placeholder="e.g., MyAwesomeApp" required />
              </div>
              <div>
                <label htmlFor="version" className={labelClass}>Version (e.g., 1.0.0.0)</label>
                <input type="text" name="version" id="version" value={metadata.version} onChange={handleInputChange} className={inputClass} placeholder="e.g., 1.0.0" pattern="\d+\.\d+\.\d+(\.\d+)?" title="Version format: X.Y.Z or X.Y.Z.W" required />
              </div>
              <div>
                <label htmlFor="company" className={labelClass}>Company</label>
                <input type="text" name="company" id="company" value={metadata.company} onChange={handleInputChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="product" className={labelClass}>Application Product Name</label>
                <input type="text" name="product" id="product" value={metadata.product} onChange={handleInputChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="productFamily" className={labelClass}>Product Family</label>
                <select
                  name="productFamily"
                  id="productFamily"
                  value={selectedFamily}
                  onChange={handleFamilyChange}
                  className={inputClass}
                >
		    {Object.keys(productFamilyOptions).map(family => (
                        <option key={family} value={family}>{family}</option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="selectedProduct" className={labelClass}>Product</label>
                <select
                  name="selectedProduct"
                  id="selectedProduct"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className={inputClass}
                  disabled={!selectedFamily}
                >
                    {(productFamilyOptions[selectedFamily] || []).map(product => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                </select>
              </div>
	      <div>
                <label htmlFor="baselineDateInput" className={labelClass}>Baseline Date (e.g. MAY25)</label>
                <input
                  type="text"
                  name="baselineDateInput"
                  id="baselineDateInput"
                  value={baselineDateInput}
                  onChange={(e) => setBaselineDateInput(e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="e.g. MAY25"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="copyright" className={labelClass}>Copyright</label>
                <input type="text" name="copyright" id="copyright" value={metadata.copyright} onChange={handleInputChange} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="trademark" className={labelClass}>Trademark</label>
                <input type="text" name="trademark" id="trademark" value={metadata.trademark} onChange={handleInputChange} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="description" className={labelClass}>Description</label>
                <textarea name="description" id="description" value={metadata.description} onChange={handleInputChange} rows="3" className={inputClass}></textarea>
              </div>
               <div>
                <label htmlFor="targetRuntime" className={labelClass}>Target Runtime Identifier (RID)</label>
                <select name="targetRuntime" id="targetRuntime" value={metadata.targetRuntime} onChange={handleInputChange} className={inputClass}>
                    <option value="win-x64">Windows (win-x64)</option>
                    <option value="linux-x64">Linux (linux-x64)</option>
                    <option value="osx-x64">macOS (osx-x64)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Determines the target OS for the self-contained executable.</p>
              </div>
            </div>
          </div>

	  {/* Driver Upload Section */}
          <div>
            <h2 className="text-2xl font-semibold text-sky-400 border-b-2 border-sky-500 pb-2 mb-6 flex items-center">
              <UploadCloud size={24} className="mr-2" /> Driver Upload
            </h2>
            <div>
              <label htmlFor="driverFile-upload-label" className={labelClass}>Driver ZIP File (.zip only)</label>
              {/* Apply drag-and-drop handlers to this div */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2  border-dashed rounded-md transition-colors
                            ${isDraggingOver ? 'border-sky-400 bg-slate-700' : 'border-gray-500 hover:border-sky-400'}`}
              >
                <div className="space-y-1 text-center">
                  <UploadCloud className={`mx-auto h-12 w-12 ${isDraggingOver ? 'text-sky-300' : 'text-gray-400'}`} />
                  <div className="flex text-sm text-gray-400">
                    <label htmlFor="driverFile-upload" className={`relative cursor-pointer rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-800 focus-within:ring-sky-500 px-2 py-1
                                                                    ${isDraggingOver ? 'text-sky-200' : 'bg-slate-700 text-sky-400 hover:text-sky-300'}`}>
                      <span>Upload a file</span>
                      <input id="driverFile-upload" name="driverFile-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".zip" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className={`text-xs ${isDraggingOver ? 'text-sky-300' : 'text-gray-500'}`}>ZIP files only</p>
                </div>
              </div>
              {driverFileName && <p className="mt-2 text-sm text-green-400">Selected: {driverFileName}</p>}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isBuilding || !driverFile}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-in-out"
            >
              {isBuilding ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Building...
                </>
              ) : (
                <>
                  <Package size={20} className="mr-2" /> Build Executable
                </>
              )}
            </button>
          </div>
        </form>

{/* Build Output Section */}
        {(buildLog.length > 0 || buildError || buildSuccess || downloadLinkInfo) && (
          <div className="mt-8 pt-6 border-t border-slate-700">
            <h3 className="text-xl font-semibold text-sky-400 mb-3">Build Output</h3>
            {buildError && ( /* ... Error message ... */ 
                 <div className="mb-4 p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg text-red-300 flex items-start">
                    <AlertTriangle size={20} className="mr-2 flex-shrink-0" /> <span>{buildError}</span>
                 </div>
            )}
            {buildSuccess && !downloadLinkInfo && ( /* Show success only if no download link yet or general success */
                <div className="mb-4 p-4 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg text-green-300 flex items-start">
                    <CheckCircle2 size={20} className="mr-2 flex-shrink-0" /> <span>{buildSuccess}</span>
                </div>
            )}
            <div ref={logContainerRef} className="bg-slate-900 p-4 rounded-lg max-h-60 overflow-y-auto text-sm font-mono">
              {buildLog.map((entry, index) => (
                <div key={index} className={`whitespace-pre-wrap ${
                  entry.type === 'error' ? 'text-red-400' : 
                  entry.type === 'success' ? 'text-green-400' : 
                  entry.type === 'backend-stdout' ? 'text-sky-300' : // Example for backend stdout
                  'text-slate-400'
                }`}>
                  <span className="text-slate-500 select-none">[{new Date(entry.timestamp).toLocaleTimeString()}] </span>
                  {entry.text}
                </div>
              ))}
            </div>
            {/* Download Link Section */}
            {downloadLinkInfo && !isBuilding && (
              <div className="mt-6 text-center">
                <a
                  href={downloadLinkInfo.url}
                  download={downloadLinkInfo.name} // This attribute suggests a filename to the browser
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-green-500 transition-all duration-150 ease-in-out"
                >
                  <Download size={20} className="mr-2" />
                  Download {downloadLinkInfo.name}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="text-center mt-8 text-slate-500 text-sm">
        <p>This is a UI demonstration for a CI build process.</p>
        <p>No actual compilation or server-side operations are performed by this interface.</p>
      </footer>
    </div>
  );
};

export default App;

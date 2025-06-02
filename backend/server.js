// build-server-backend/server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001; // Backend port

// --- Configuration ---
const UPLOAD_DIR = path.join(__dirname, 'uploads'); // Temporary storage for uploaded drivers
const SCRIPTS_DIR = path.resolve(__dirname, '../scripts'); // Assumes 'scripts' is one level up from 'build-server-backend'
const BUILD_SCRIPT_NAME = 'build.sh';
const REPO_ROOT_FOR_SCRIPT = path.resolve(__dirname, '..'); // Path to where build_output will be relative to for the script

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- Middleware ---
app.use(cors()); // Allow Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
	console.log('--- Inside Filename callback ---');
	try {
	    console.log('Received file object:', JSON.stringify(file, null, 2));
	    if (!file || typeof file.originalname !== 'string') {
	        const errMsg = 'Critical Error: File object or file.originalname is invalid.';
		console.error(errMsg, 'file:', file);
		return cb(null, `error-${Date.now()}.zip`);
	    }

	    console.log(`Original filename: '${file.originalname}'`);

	    const newId = uuidv4();
	    console.log(`New UUID: '${newId}' (Type: ${typeof newId})`);

	    const extension = path.extname(file.originalname);
	    console.log(`Detected Extension: '${extension}' (Type: ${typeof extension})`);

	    const finalFilename = `${newId}${extension}`;
	    console.log(`Constructed final filename: '${finalFilename}' (Type: ${typeof finalFilename})`);

	    cb(null, finalFilename);
	} catch (error) {
	    console.error('--- CRITICAL ERROR in filename callback ---:', error);
	    cb(null, `catch-error-${Date.now()}.zip`);
	}
    }
});
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.zip') {
            return cb(new Error('Only .zip files are allowed!'), false);
        }
        cb(null, true);
    }
});

// --- API Endpoints ---

// POST /build - Endpoint to trigger a build
app.post('/build', upload.single('driverFile'), (req, res) => {
    console.log('Received build request:');
    console.log('Metadata:', req.body);
    console.log('File:', req.file);

    if (!req.file) {
        return res.status(400).json({ message: 'Driver ZIP file is required.' });
    }

    const {
        appName, version, company, product, copyright,
        trademark, description, targetRuntime,
	selectedFamily, selectedProduct,
        baselineDateInput
    } = req.body;

    // --- Input Validation/Sanitization (CRUCIAL for security) ---
    // For simplicity, this example assumes inputs are safe.
    // In production, validate and sanitize all inputs thoroughly before passing to a shell script.
    // Example: Ensure version matches a pattern, appName is alphanumeric, etc.

    const driverZipUploadedPath = req.file.path; // Path to the uploaded driver.zip

    // Arguments for build.sh
    const scriptArgs = [
        appName || 'DefaultApp',
        version || '1.0.0',
        company || 'DefaultCompany',
        product || 'DefaultProduct',
        copyright || `Copyright © ${new Date().getFullYear()}`,
        trademark || '',
        description || 'Default Description',
        driverZipUploadedPath,
        targetRuntime || 'win-x64',
	selectedFamily || 'Host (CoreStaion)',
	selectedProduct || 'HX2000',
	baselineDateInput || 'UNDATED'
    ];

    const buildScriptPath = path.join(SCRIPTS_DIR, BUILD_SCRIPT_NAME);
    const logArgs = [...scriptArgs];
    logArgs[7] = '[driverPath]';
    console.log(`Executing: ${buildScriptPath} with args:`, logArgs); // Don't log full driver path to console if sensitive

    // Ensure build script is executable (usually done once with chmod +x)
    // Forcing working directory to REPO_ROOT for the script
    const buildProcess = spawn(buildScriptPath, scriptArgs, { cwd: REPO_ROOT_FOR_SCRIPT });

    let scriptOutput = '';
    let errorOutput = '';

    buildProcess.stdout.on('data', (data) => {
        scriptOutput += data.toString();
        console.log(`stdout: ${data}`);
        // TODO: Stream this to the client if desired
    });

    buildProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`stderr: ${data}`);
        // TODO: Stream this to the client if desired
    });

    buildProcess.on('close', (code) => {
        console.log(`Build script exited with code ${code}`);

        // Clean up the uploaded driver file
        fs.unlink(driverZipUploadedPath, (err) => {
            if (err) console.error(`Error deleting uploaded driver ZIP: ${err}`);
            else console.log(`Deleted uploaded driver ZIP: ${driverZipUploadedPath}`);
        });
        // Note: The build.sh script itself should delete the CoreStationHX.zip it creates

        if (code === 0) {
            // Build successful, find the output file
            // This part needs to be robust based on your build.sh output logic
            // The build.sh script outputs "Output executable(s) available in: $OUTPUT_DIR"
            // And then `ls -l $OUTPUT_DIR`
            // We need to parse scriptOutput or know the naming convention.
            const outputDirMatch = scriptOutput.match(/Output executable\(s\) available in: (.*)/);
            let downloadPath = null;
            let fileName = null;

            if (outputDirMatch && outputDirMatch[1]) {
                const relativeOutputDir = outputDirMatch[1].trim();
                // Construct absolute path based on REPO_ROOT where script was run
                const absoluteOutputDir = path.resolve(REPO_ROOT_FOR_SCRIPT, relativeOutputDir);

                // Try to find the .exe or binary in the output directory
                // This is a simple way; might need to be more robust
                const filesInOutputDir = fs.readdirSync(absoluteOutputDir);
                fileName = filesInOutputDir.find(f => f.endsWith('.exe') || !f.includes('.')); // Basic find for exe or extensionless

                if (fileName) {
                    // This is not a direct download link, but info for the client to make another request
                    // Or you could generate a temporary tokenized link
                    downloadPath = `/download/<span class="math-inline">\{path\.basename\(absoluteOutputDir\)\}/</span>{fileName}`;
                     res.json({
                        message: 'Build successful!',
                        log: scriptOutput,
                        errorLog: errorOutput,
                        downloadInfo: { 
                            buildDir: path.basename(absoluteOutputDir), 
                            fileName: fileName 
                        } // Client will use this to construct download URL
                    });
                } else {
                    res.status(500).json({ message: 'Build succeeded, but output file not found.', log: scriptOutput, errorLog: errorOutput });
                }
            } else {
                 res.status(500).json({ message: 'Build succeeded, but output directory not identified from script log.', log: scriptOutput, errorLog: errorOutput });
            }
        } else {
            res.status(500).json({
                message: 'Build failed.',
                log: scriptOutput,
                errorLog: errorOutput
            });
        }
    });

    buildProcess.on('error', (err) => {
        console.error('Failed to start build script:', err);
        fs.unlink(driverZipUploadedPath, (unlinkErr) => { // Cleanup on error too
            if (unlinkErr) console.error(`Error deleting uploaded driver ZIP on spawn error: ${unlinkErr}`);
        });
        res.status(500).json({ message: 'Failed to start build script.', error: err.message });
    });
});


// GET /download/:buildDir/:fileName - Endpoint to download the built executable
app.get('/download/:buildDir/:fileName', (req, res) => {
    const { buildDir, fileName } = req.params;

    // IMPORTANT: Sanitize buildDir and fileName to prevent directory traversal attacks!
    const safeBuildDir = path.normalize(buildDir).replace(/^(\.\.(\/|\\|$))+/, '');
    const safeFileName = path.normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, '');

    if (safeBuildDir.includes('..') || safeFileName.includes('..')) {
        return res.status(400).send('Invalid path components.');
    }

    // Construct path relative to where build.sh places its output base
    const filePath = path.join(REPO_ROOT_FOR_SCRIPT, 'build_output', safeBuildDir, safeFileName);

    console.log(`Download request for: ${filePath}`);

    if (fs.existsSync(filePath)) {
        res.download(filePath, safeFileName, (err) => {
            if (err) {
                console.error("Error downloading file:", err);
                // res.headersSent is important because if headers were already sent,
                // we can't send a new status code.
                if (!res.headersSent) {
                    res.status(500).send("Error during file download.");
                }
            }
            // Optionally, clean up the specific build output directory or file after download
            // This needs careful consideration for retries or multiple downloads.
            // For simplicity, not deleting here.
        });
    } else {
        console.error(`File not found for download: ${filePath}`);
        res.status(404).send('File not found.');
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Uploads directory: ${UPLOAD_DIR}`);
    console.log(`Scripts directory: ${SCRIPTS_DIR}`);
    console.log(`Build script path: ${path.join(SCRIPTS_DIR, BUILD_SCRIPT_NAME)}`);
    console.log(`Script working directory (REPO_ROOT_FOR_SCRIPT): ${REPO_ROOT_FOR_SCRIPT}`);
});

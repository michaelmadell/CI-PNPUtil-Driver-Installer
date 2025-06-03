using Crayon;
using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security;
using System.Security.Permissions;
using System.Threading.Tasks;

using static Crayon.Output;

namespace Console_Installer
{
    internal class Program
    {
        [DllImport("kernel32.dll")]
        private static extern bool AllocConsole();

        [STAThread]
        static void Main(string[] args)
        {
	    int currentBufferHeight = Console.BufferHeight;
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            Console.SetWindowSize(110,34);
            Console.SetBufferSize(110, currentBufferHeight);
            DisplayAsciiArt();
            Console.WriteLine(" " + Bold().Green().Underline().Text("Welcome to the Amulet Hotkey Baseline Instaler\r"));
            string assemblyName = Assembly.GetExecutingAssembly().GetName().Name;
            if (args == null || args.Length == 0)
            {
                Console.WriteLine(Rgb(196,160,0).Text(" No Argument provided, Please Choose an Option:\n\n"));
                Console.WriteLine(Bold().Text(" 1 - Install\n 2 - Extract\n 3 - Help\n"));
                Console.Write(" Enter Your Choice: ");
                string choice = Console.ReadLine()?.Trim();

                switch (choice)
                {
                    case "1":
                        args = new[] { "install" };
                        break;
                    case "2":
                        args = new[] { "extract" };
                        break;
                    case "3":
                        args = new[] { "help" };
                        break;
                    default:
                        Console.WriteLine(Red().Bold().Text(" Invalid Choice, Exiting ..."));
                        return;

                }
            }
            bool silent = false;
            string mode = args[0].ToLower();

            switch (mode)
            {
                case "install":
                    string existingBaseline = ReadRegistryKey("Current_Baseline");
                    if (existingBaseline == BuildInfo.EffectiveCurrentBaselineRegVal)
                    {
                        Console.ForegroundColor = ConsoleColor.Yellow;
                        Console.WriteLine($" The Currently Installed Baseline is already '{existingBaseline}'.");
                        Console.WriteLine(" Are you sure you want to install the same Baseline version? (Y/N)");
                        Console.ForegroundColor = ConsoleColor.White;
                        Console.SetCursorPosition(1, Console.CursorTop);
                        string keyInfo = Console.ReadLine()?.Trim().ToLower();
                        Console.WriteLine();
                        if (keyInfo != "y")
                        {
                            Console.WriteLine(Rgb(196, 160, 0).Text(" Installation Cancelled"));
                            return;
                        }
                    }
                    if (!DisplayEula())
                    {
                        Console.WriteLine(Rgb(196, 160, 0).Text(" Operation Cancelled by User"));
                        return;
                    }
                    InstallDrivers(silent);
                    WriteRegistryKeys(BuildInfo.EffectiveCurrentBaselineRegVal);
                    DeleteTempFolder();
                    if (!silent)
                    {
                        PromptForReboot();
                    }
                    break;

                case "installsilent":
                    silent = true;
                    InstallDrivers(silent);
                    WriteRegistryKeys(BuildInfo.EffectiveCurrentBaselineRegVal);
                    DeleteTempFolder();
                    break;

                case "extract":
                    if (!DisplayEula())
                    {
                        Console.WriteLine(Rgb(196, 160, 0).Text(" Operation Cancelled by User"));
                        return;
                    }
                    ExtractDrivers();
                    break;

                case "help":
                case "?":
                case "/?":
                case "/help":
                case "-help":
                case "--help":
                case "-?":
                case "--?":
                case "-h":
                case "/h":
                    Console.Clear();
                    DisplayAsciiArt();
                    showHelp(mode);
                    break;

                default:
                    Console.WriteLine(Red().Text(" Invalid Choice. Exiting..."));
                    break;
            }
            if (silent == true)
            {
                IsSilent();
            }
            else
            {
                NotSilent();
            }

        }
        static string ReadRegistryKey(string keyName)
        {
            using (RegistryKey key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Amulet Hotkey"))
            {
                Console.WriteLine(Cyan().Bold().Text($"\n Existing Reg KEY: {key?.GetValue(keyName)?.ToString()}\n"));
                return key?.GetValue(keyName)?.ToString() ?? "Unknown";
            }
        }
        static void WriteRegistryKeys(string effectiveCurrentBaselineFromBuild)
        {
            try
            {
                using (RegistryKey key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Amulet Hotkey", writable: true))
                {
                    if (key == null)
                    {
                        Console.WriteLine(Red().Bold().Text("Error: Failed to access registry key."));
                        return;
                    }

                    string previousBaseline = key.GetValue("Current_Baseline")?.ToString() ?? "None";
                    key.SetValue("Previous_Baseline", previousBaseline);
                    Console.WriteLine(Yellow().Bold().Text($" Previous Baseline key updated to: {previousBaseline}"));

                    key.SetValue("Current_Baseline", effectiveCurrentBaselineFromBuild);
                    Console.WriteLine(Green().Bold().Text($" Current Baseline key updated to: {effectiveCurrentBaselineFromBuild}"));
                }
            }
            catch (UnauthorizedAccessException)
            {
                Console.WriteLine(Red().Bold().Text(" Error: Access to the registry key was denied. Run the application as Administrator."));
            }
            catch (SecurityException)
            {
                Console.WriteLine(Red().Bold().Text(" Error: Security exception occurred while accessing the registry."));
            }
            catch (Exception ex)
            {
                Console.WriteLine(Red().Bold().Text($" Unexpected error updating registry: {ex.Message}"));
            }
        }

        static void NotSilent()
        {
            Console.WriteLine(Green().Bold().Text("\n Operation Complete, Press any key to Exit..."));
            Console.ReadKey();
        }
        static void IsSilent()
        {
            Console.WriteLine(Green().Bold().Text("\n Operation Complete. Exiting..."));
        }
        static void showHelp(string mode)
        {
            string paddedMode = mode.PadRight(14);
            string current = ReadRegistryKey("Current_Baseline");
	    string displayFamilyForTitle = BuildInfo.ProductFamily;
	    if (BuildInfo.ProductFamily == "Host (CoreStation)")
	    {
		displayFamilyForTitle = "CoreStation";
	    }

            Console.WriteLine("\n Help Information:\n" +
			$" This Installer is for the {displayFamilyForTitle} {BuildInfo.SelectedProduct}" +
                        " Commands:\n" +
                        " ─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─\n" +
                        "   install       --  Installs Drivers to current system\n" +
                        " ─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─\n" +
                        "   installsilent --  Installs Drivers to current system without user input,\n" +
                        "                     by using this option, you accept all licenses for \n" +
                        "                     drivers included in this baseline\n" +
                        " ─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─\n" +
                        "   extract       --  Extracts Drivers to a chosen location\n" +
                        " ─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─\n" +
                        $"   {paddedMode}--  Display this help information\n" +
                        " ─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─═─\n\n" +
                        $" Currently Installed Baseline: {current}\n" +
                        $" {BuildInfo.EffectiveBaseline}\n" +
                        " Created by Michael Madell\n" +
                        " Copyright Amulet Hotkey Ltd. 2025\r");
        }
        static void DisplayAsciiArt()
        {
	    string displayFamilyForTitle = BuildInfo.ProductFamily;
	    if (BuildInfo.ProductFamily == "Host (CoreStation)")
	    {
		displayFamilyForTitle = "CoreStation";
	    }
            string asciiArt = Environment.NewLine + @"   /$$$$$$                       /$$           /$$" + Environment.NewLine +
@"  /$$__  $$                     | $$          | $$" + Environment.NewLine +
@" | $$  \ $$/$$$$$$/$$$$ /$$   /$$ $$ /$$$$$$ /$$$$$$                :----:      :--=--.     .--=--." + Environment.NewLine +
@" | $$$$$$$$ $$_  $$_  $$ $$  | $$ $$/$$__  $$_  $$_/            -*%@@@@@@@@%+::%@@@@@@@@#=.*@@@@@@@@#=." + Environment.NewLine + 
@" | $$__  $$ $$ \ $$ \ $$ $$  | $$ $$ $$$$$$$$ | $$            -%@@*-.   .:=*@@%-:.   .-+%@@+:.   .:+#@@*." + Environment.NewLine +
@" | $$  | $$ $$ | $$ | $$ $$  | $$ $$ $$_____/ | $$ /$$       #@@=        :@*:*@@=    .@%-:%@@:       :%@@:" + Environment.NewLine +
@" | $$  | $$ $$ | $$ | $$  $$$$$$/ $$  $$$$$$$ |  $$$$/      *@@-        :@@#  -@@=   %@#   %@@         %@@." + Environment.NewLine +
@" |/$$  |/$$__/ |__/ |_/$$______/|__/\_______/  \____/       @@#         *@@.   %@@  =@@:   -@@=        -@@=" + Environment.NewLine +
@" | $$  | $$          | $$   | $$                            @@*         *@@    #@@  =@@.   :@@=        :@@+" + Environment.NewLine +
@" | $$  | $$ /$$$$$$ /$$$$$$ | $$   /$$ /$$$$$$ /$$   /$$    %@@         -@@=  .@@*  .@@+   *@@:        *@@:" + Environment.NewLine +
@" | $$$$$$$$/$$__  $$_  $$_/ | $$  /$$//$$__  $$ $$  | $$    :@@%.        *@@= #@%    =@@+ =@@+        +@@+" + Environment.NewLine +
@" | $$__  $$ $$  \ $$ | $$   | $$$$$$/  $$$$$$$$ $$  | $$     .#@@*:       -@@%=-      -@@@=--      .=%@@-" + Environment.NewLine +
@" | $$  | $$ $$  | $$ | $$ /$$ $$_  $$  $$_____/ $$  | $$       -#@@@#****##-+%@@%#***##-=#@@%#***#%@@%=" + Environment.NewLine +
@" | $$  | $$  $$$$$$/ |  $$$$/ $$ \  $$  $$$$$$$  $$$$$$$          :=+*##*+=:   -+*###*=:   -=*###*+-" + Environment.NewLine +
@" |__/  |__/\______/   \___/  __/  \__/\_______/\____  $$" + Environment.NewLine +
@"                                               /$$  | $$" + Environment.NewLine +
@"                                              |  $$$$$$/" + Environment.NewLine +
@"                                               \______/ " + Environment.NewLine;
            //Console.ForegroundColor = ConsoleColor.Blue;
            Console.WriteLine(Bold().Rgb(135,229,235).Text(asciiArt));
            Console.SetCursorPosition(1, Console.CursorTop);
            Console.WriteLine($"Amulet Hotkey Baseline Installer for {displayFamilyForTitle} {BuildInfo.SelectedProduct}\r");
            Console.WriteLine(" \x00a9 Amulet Hotkey Ltd 2025\r");
            Console.WriteLine($" {BuildInfo.EffectiveBaseline}\n");
        }
        static bool DisplayEula()
        {
            Console.WriteLine(" End User License Agreement (EULA)\n" +
                " By Installing / Using this Baseline Driver Pack, you accept the EULAs for each of the\n"+ 
                " Drivers Included in this Pack.\n" +
                " To Accept EULAs and Continue, Press 'A', or to Cancel, Press 'C'\n");
            while (true)
            {
                Console.WriteLine(" Your Choice (A/C):\n");
                Console.SetCursorPosition(1, Console.CursorTop);
                string keyinfo = Console.ReadLine()?.Trim().ToLower();

                switch (keyinfo)
                {
                    case "a":
                        return true;

                    case "c":
                        return false;

                    default:
                        Console.WriteLine(Rgb(196,160,0).Bold().Text(" Invalid Choice. Press 'A' to Accept, or 'C' to Cancel."));
                        break;
                }
            }
        }
        static async Task InstallDrivers(bool silent)
        {
            Console.Clear();
            DisplayAsciiArt();
            string tempPath = Path.Combine("C:\\temp\\Amulet_Hotkey", "Baseline");
            Console.WriteLine(Cyan().Text(" Extracting Drivers to:" + tempPath));
            ExtractEmbeddedZip(tempPath);

            Console.WriteLine(Cyan().Text("\n Installing Drivers ..."));

            string pnputilPath = Path.Combine(Environment.SystemDirectory, "pnputil.exe");

            if (!System.IO.File.Exists(pnputilPath))
            {
                Console.WriteLine(Bold().Red().Text($" pnputuil.exe not found in {pnputilPath}"));
                return;
            }

            string[] infFiles = Directory.GetFiles(tempPath, "*.inf", SearchOption.AllDirectories);
            int totalFiles = infFiles.Length;

            if (totalFiles == 0)
            {
                Console.WriteLine(Red().Bold().Text(" No Drivers Found to install. Contact Amulet Hotkey"));
                return;
            }

            for (int i = 0; i < infFiles.Length; i++)
            {
                string infFile = infFiles[i];

                Console.SetCursorPosition(0, Console.CursorTop);
                Console.WriteLine(Cyan().Text($"\n\n Installing: {Path.GetFileName(infFile)} ({i + 1}/{infFiles.Length})"));


                // string systemDirectory = Environment.GetEnvironmentVariable("windir");
                try
                {

                    var process = Process.Start(new ProcessStartInfo
                    {
                        FileName = pnputilPath,
                        Arguments = $"/add-driver \"{infFile}\" /install",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    });

                    if (process == null)
                    {
                        Console.WriteLine(Bold().Red().Text(" Error, failed to start pnputil process for " + infFile));
                        continue;
                    }

                    process.WaitForExit();
                    int exitCode = process.ExitCode;

                    if (exitCode == 0)
                    {
                        Console.SetCursorPosition(0, Console.CursorTop);
                        Console.Write(new string(' ', Console.WindowWidth));
                        Console.SetCursorPosition(0, Console.CursorTop - 1);
                        Console.WriteLine(Bold().Green().Text($"\n Installed: {Path.GetFileName(infFile)}"));
                    }
                    else if (exitCode == 2)
                    {
                        Console.SetCursorPosition(0, Console.CursorTop);
                        Console.Write(new string(' ', Console.WindowWidth));
                        Console.SetCursorPosition(0, Console.CursorTop - 1);
                        Console.WriteLine(Bold().Red().Text($"\n Failed to find file specified: {Path.GetFileName(infFile)}"));
                    }
                    else if (exitCode == 259)
                    {
                        Console.SetCursorPosition(0, Console.CursorTop);
                        Console.Write(new string(' ', Console.WindowWidth));
                        Console.SetCursorPosition(0, Console.CursorTop - 1);
                        Console.WriteLine(Bold().Yellow().Text($"\n Couldn't Install: {Path.GetFileName(infFile)}. No Devices match the supplied driver, or the driver is Newer than the one being installed"));
                    }
                    else if (exitCode == 3010)
                    {
                        Console.SetCursorPosition(0, Console.CursorTop);
                        Console.Write(new string(' ', Console.WindowWidth));
                        Console.SetCursorPosition(0, Console.CursorTop - 1);
                        Console.WriteLine(Bold().Cyan().Text($"\n Installed: {Path.GetFileName(infFile)}. System Reboot is required"));
                    }
                    else
                    {
                        Console.WriteLine(Red().Bold().Text($"\n Failed to install: {infFile}. Exit code {process.ExitCode}"));
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine(Red().Bold().Text($"\n Error installing {infFile}: {ex.Message}"));
                }
                DisplayProgress(i + 1, totalFiles);

            }

            Console.WriteLine(Bold().Green().Text("\n\n Driver installation complete\n"));

        }
        static void PromptForReboot()
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("\n One or more drivers require a system reboot to complete installation.");
            Console.WriteLine(" Would you like to restart the system now? (Y/N)");
            Console.ForegroundColor = ConsoleColor.White;

            while (true)
            {
                Console.Write("\n Your Choice (Y/N): ");
                string keyInfo = Console.ReadLine()?.Trim().ToLower();

                switch (keyInfo)
                {
                    case "y":
                        Console.WriteLine(Bold().Cyan().Text("\n Restarting system in 5 seconds..."));
                        Process.Start("shutdown", "/r /t 5"); // Restarts the system after 5 seconds
                        return;

                    case "n":
                        Console.WriteLine(Cyan().Bold().Text("\n Reboot postponed. Please restart manually to complete installation."));
                        return;

                    default:
                        Console.WriteLine(Rgb(196,160,0).Text(" Invalid choice. Press 'Y' to restart now or 'N' to restart later."));
                        break;
                }
            }
        }
        static void ExtractDrivers()
        {
            Console.Clear();
            DisplayAsciiArt();
            Console.WriteLine(Cyan().Bold().Text(" Enter the Directory where you'd like the drivers extracted to:"));
            Console.SetCursorPosition(1, Console.CursorTop);
            string targetPath = Console.ReadLine();

            if (string.IsNullOrEmpty(targetPath))
            {
                Console.SetCursorPosition(1, Console.CursorTop);
                Console.WriteLine(Rgb(196,160,0).Bold().Text("Invalid Path, Exiting ..."));
                return;
            }

            targetPath = Path.Combine(targetPath, "Baseline");

            Console.WriteLine(Cyan().Bold().Text("\n Extracting Drivers to: " + targetPath));
            ExtractEmbeddedZip(targetPath);

            Console.WriteLine(Green().Bold().Text("\n Extraction Complete"));
        }
        static void ExtractEmbeddedZip(string targetPath)
        {
            try
            {
                Directory.CreateDirectory(targetPath);
		
		string expectedResourceName = $"Console_Installer.{BuildInfo.DriverPackZipName}";
		Console.WriteLine(Cyan().Text($"[DEBUG] RootNamespace from csproj: Console_Installer"));
		Console.WriteLine(Cyan().Text($"[DEBUG] BuildInfo.DriverPackZipName: '{BuildInfo.DriverPackZipName}'"));
		Console.WriteLine(Cyan().Text($"[DEBUG] Attempting to load embedded resource with full name: '{expectedResourceName}'"));
		Console.WriteLine(Cyan().Text($"Attempting to load embedded resource: {expectedResourceName}"));

		Assembly assembly = Assembly.GetExecutingAssembly();
		string[] allResources = assembly.GetManifestResourceNames();
		Console.WriteLine(Yellow().Bold().Text("[DEBUG] Available Manifest Resources: "));
		foreach (string resource in allResources) {
		  Console.WriteLine(Yellow().Text($"  - {resource}"));
		}

                using (Stream stream = assembly.GetManifestResourceStream(expectedResourceName))
                {
                    if (stream == null)
                    {
                        Console.WriteLine(Red().Bold().Text(" Error: Embedded Zip File not Found\nContact Amulet Hotkey"));
                        return;
                    }

                    long totalBytes = stream.Length;
                    long extractedBytes = 0;

                    using (FileStream fileStream = new FileStream(Path.Combine(targetPath, "Drivers.zip"), FileMode.Create, FileAccess.Write))
                    {
                        byte[] buffer = new byte[8192];
                        int bytesRead;

                        while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            fileStream.Write(buffer, 0, bytesRead);
                            extractedBytes += bytesRead;

                            DisplayProgress(extractedBytes, totalBytes);
                            //stream.CopyTo(fileStream);
                        }
                    }

                    ZipFile.ExtractToDirectory(Path.Combine(targetPath, "Drivers.zip"), targetPath);
                    System.IO.File.Delete(Path.Combine(targetPath, "Drivers.zip"));
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(Red().Bold().Text($"\n Error extracting zip file: {ex.Message}"));
            }
        }
        static void DeleteTempFolder()
        {
            string tempFolderPath = @"C:\Temp\Amulet_Hotkey";

            try
            {
                if (Directory.Exists(tempFolderPath))
                {
                    Directory.Delete(tempFolderPath, true); // true = delete recursively
                    Console.WriteLine(Green().Bold().Text($"\n Successfully deleted: {tempFolderPath}"));
                }
                else
                {
                    Console.WriteLine(Red().Bold().Text($"\n Folder not found: {tempFolderPath}"));
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine(Red().Bold().Text($"\n Error deleting folder: {ex.Message}"));
            }
        }
        /// <summary>
        /// Displays a progress bar based on current progress and total items
        /// </summary>
        /// <param name="current">The Current Progress</param>
        /// <param name="total">The total number of items</param>
        static void DisplayProgress(long current, long total)
        {
            int barWidth = 50;
            double progress = (double)current / total;
            int progressBlocks = (int)(barWidth * progress);

            Console.SetCursorPosition(0, Console.CursorTop);
            Console.Write(" [");
            Console.Write(Green().Bold().Text(new string('=', progressBlocks)));
            Console.Write(Yellow().Text(new string('-', barWidth - progressBlocks)));
            Console.Write($"] {progress:P0}");
        }
        public class NewDev
        {
            [DllImport("newdev.dll", CharSet = CharSet.Unicode, SetLastError = true)]
            [return: MarshalAs(UnmanagedType.Bool)]
            private static extern bool DiInstallDriverW(
                IntPtr hwndParent,
                [MarshalAs(UnmanagedType.LPWStr)] string fullInfPath,
                uint flags,
                out bool rebootRequired
                );

            public void InstallDriver(string infPath)
            {
                bool rebootRequired;
                bool result = DiInstallDriverW(IntPtr.Zero, infPath, 0, out rebootRequired);

                if (result)
                {
                    Console.WriteLine("Driver Installed Successfully!");
                    if (rebootRequired)
                    {
                        Console.WriteLine("A Reboot Is required to complete installation.");
                    }
                }
                else
                {
                    int error = Marshal.GetLastWin32Error();
                    Console.WriteLine($"Error: {error}");
                }
            }
        }
    }
}

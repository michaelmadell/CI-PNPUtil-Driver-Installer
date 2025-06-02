# Amulet Hotkey Baseline Driver Installer

## Overview
The **Amulet Hotkey Baseline Driver Installer** is a utility designed to install drivers from an embedded `.zip` file using `PNPUtil.exe`. This tool streamlines driver deployment for systems by handling extraction, installation, and registry updates.

### Key Features:
- **Automated Driver Installation** – Uses `PNPUtil.exe` to install drivers efficiently.
- **Embedded Driver Pack Support** – Installs drivers from a pre-packaged `.zip` file.
- **Registry Tracking** – Updates system registry with the current and previous driver baselines.
- **Silent Installation Mode** – Enables seamless deployment via automation tools.
- **Reboot Handling** – Detects if a reboot is required and prompts the user accordingly (unless in silent mode).
- **EULA Confirmation** – Ensures compliance with licensing agreements before installation.

---
## Driver Pack Requirements
The driver `.zip` file **is not included in the source code** due to size constraints. However, you can easily create one using Windows' built-in ZIP functionality or third-party tools like **7-Zip**.

### Driver Pack Structure
Ensure that your `.zip` file contains the extracted driver files, structured for compatibility with the installation and extraction methods. **Best practice:** Organize your drivers into separate folders for each device to simplify installation.

---
## Configuration
Modify the following constants in `Program.cs`, add your driver `.zip`, and mark it as an `Embedded Resource` before building:

```csharp
// Edit these values in Program.cs
const string driverPackZipName = "<yourzipnamehere>";
const string baseline = "<Your Baseline Title Here>";
const string currentBaseline = "<yourbaselineversioninghere>";
const string previousBaseline = "<previousbaselineversioninghere>";
```

### Description of Configuration Values:
| **Variable**          | **Purpose** |
|----------------------|-------------|
| `driverPackZipName`  | The exact name of your embedded driver `.zip` file. Must match the resource name in the project. |
| `baseline`           | A human-readable title for the driver baseline, e.g., `"Manufacturer Product Baseline MMMYY"`. |
| `currentBaseline`    | Version string used for updating the registry key `HKLM\SOFTWARE\Amulet Hotkey\Current_Baseline`. Matches the assembly version and baseline name. |
| `previousBaseline`   | The last recorded `currentBaseline` version. Used for troubleshooting and rollback purposes. |

---
## Usage
This application can be executed from **CMD / PowerShell / Terminal / Run / Explorer**.

> **Admin Rights Required:** The application requires **local administrator privileges** to function. It will prompt for elevation if necessary.

### Command-Line Arguments

| **Command**         | **Description** |
|---------------------|----------------|
| `install`          | Installs the drivers, asking the user to accept EULAs before extracting and installing the `.inf` files. |
| `installsilent`    | Installs drivers **without user input**, ideal for **Intune** and automated deployments. **(Accepts all EULAs automatically.)** |
| `extract`          | Extracts the driver files to a user-specified directory after confirming EULA acceptance. |
| `help`, `/?`, `--help`, `-h` | Displays help information, including the current installed and application baseline version. |

---
## Functionality Breakdown

### **Driver Installation Process**
1. **Extracts Drivers:**
   - The `.zip` file is extracted to `C:\temp\Amulet_Hotkey\Baseline` (for installation) or a user-specified directory (for extraction only).
   
2. **Installs Drivers Using `PNPUtil.exe`:**
   - Recursively scans for `.inf` driver files.
   - Uses `PNPUtil.exe` to install each `.inf` file to the system.

3. **Handles Registry Updates:**
   - Updates `HKLM\SOFTWARE\Amulet Hotkey\Current_Baseline` with the new version.
   - Stores the previous baseline in `HKLM\SOFTWARE\Amulet Hotkey\Previous_Baseline`.

4. **Handles Reboots (If Required):**
   - If any driver installation exits with **3010 (Reboot Required)**, the system will prompt the user:
     - **Non-Silent Mode:** The user can choose to restart immediately or later.
     - **Silent Mode:** The application logs that a reboot is needed but does not prompt.

---
## Release Notes
Release notes for each build will be included alongside the application in the **Releases** section.

---
### Example Usage
#### **Run Installer with User Prompting**
```powershell
AmuletHotkeyInstaller.exe install
```

#### **Run Silent Installation (No User Input Required)**
```powershell
AmuletHotkeyInstaller.exe installsilent
```

#### **Extract Drivers to a Custom Location**
```powershell
AmuletHotkeyInstaller.exe extract
```

#### **Display Help Information**
```powershell
AmuletHotkeyInstaller.exe --help
```

---
### **Contributors**
Developed by **Michael Madell**  
© 2025 Amulet Hotkey Ltd.

---
### **License**
This project is licensed under **Amulet Hotkey Ltd. Copyright 2025**. Redistribution without permission is prohibited.


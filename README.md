# CI PNPUtil Driver Installer & Builder

This project provides a web interface to build a self-contained C# console application designed to install drivers using `pnputil.exe`. Users can specify metadata, product family, product, and a baseline date via a React frontend. A Node.js backend orchestrates the build process by executing a shell script that compiles the C# application and embeds a user-provided driver ZIP file.

## Overview

* **Frontend:** React application (`ci-build-interface`) for user input and triggering builds.
* **Backend:** Node.js/Express server (`build-server-backend`) that handles requests, manages file uploads, and executes the build script.
* **Build Script:** A shell script (`scripts/build.sh`) that compiles the C# console application, embeds drivers, and sets version metadata.
* **C# Application:** A .NET console application (`ConsoleInstaller`) that is built by the system to perform driver installations.

## Prerequisites

Before you begin, ensure you have the following installed on the machine that will run the backend and build process (e.g., your Linux server):

* **Git:** For cloning the repository.
* **Node.js:** Version 18.x or newer (LTS recommended). This will include `npm`.
* **.NET SDK:** Version 8.0.x (or the version your C# `ConsoleInstaller` project targets). This is required for the `dotnet publish` command used by the build script.
* **`chmod` utility:** For making the build script executable (standard on Linux).
* **A modern web browser:** For accessing the frontend.

## Getting Started

### 1. Clone the Repository

  Clone this repository to your local machine or server:
  ```bash
git clone <your-repository-url>
cd <repository-name>
  ```
### 2. Backend Setup (`backend`)
  The backend server handles API requests from the frontend and executes the build script.

  ```bash

cd build-server-backend
npm install
  ```
  This will install the necessary Node.js dependencies (Express, Multer, CORS, UUID).

### Configuration:

* The backend server listens on port 3001 by default (see server.js).
* Paths to the scripts directory and the repository root are configured in server.js. Ensure these are correct relative to where server.js is located if you modify the directory structure:
  * SCRIPTS_DIR: Should point to the scripts folder containing build.sh.
  * REPO_ROOT_FOR_SCRIPT: Should be the parent directory of scripts and ConsoleInstaller, used as the working directory for build.sh.
  * UPLOAD_DIR: Temporary directory for driver uploads (defaults to build-server-backend/uploads/).
### 3. Frontend Setup (`ci-build-interface`)
  The frontend is a React application built with Vite.

  ```Bash

cd ci-build-interface
npm install
```
  This will install the React app's dependencies.

### Configuration:

* The React app's API calls in `src/App.jsx` are currently configured to connect to the backend at `http://10.50.0.107:3001`. You must update this IP address to match the actual IP address of the machine where your Node.js backend server is running if it's different.
  * Search for `http://10.50.0.107:3001` in `src/App.jsx` and replace `10.50.0.107` with the correct backend server IP.
* If running the Vite dev server on a headless machine or needing external access, ensure `vite.config.js` is configured correctly (e.g., `server.host` and `server.hmr.host` settings as discussed).
### 4. Build Script Setup (`scripts/build.sh`)
  Ensure the main build script is executable:

  ```Bash

chmod +x scripts/build.sh
```
### Configuration:

* The `build.sh` script contains logic to determine baseline names based on product family, product, and version inputs. Review and customize this logic if needed.
* It expects the C# project (`ConsoleInstaller/Console Installer.csproj`) to be correctly set up for dotnet publish and to use the auto-generated `BuildInfo.cs` file.
### Running the Application
1. Start the Backend Server:
  Navigate to the backend directory and run:

  ```Bash

cd build-server-backend
node server.js
```
   You should see a confirmation that the server is running (e.g., `Backend server running on http://localhost:3001` - though it listens on all interfaces for external connections).

2. Start the React Frontend Development Server:
  Open a new terminal, navigate to the frontend directory, and run:

  ```Bash

cd ci-build-interface
npm run dev
```
   This will typically start the frontend on a port like `5173`. The output will give you the URL (e.g., `http://<your-server-ip>:5173`).

3. Access the Application:
  Open your web browser and navigate to the URL provided by the React development server (e.g., `http://<your-server-ip>:5173` or `http://localhost:5173` if accessing from the same machine where the Vite dev server is running and configured to allow it).

### How It Works
1. The user interacts with the React frontend, providing metadata, selecting product family, product, baseline date, and uploading a driver `.zip` file.
2. Upon clicking "Build Executable," the frontend sends this data and the file to the *Node.js backend** API endpoint (`/build`).
3. The backend saves the uploaded driver ZIP temporarily and then executes the `scripts/build.sh` script, passing all the user-provided parameters.
4. The build.sh script:
  * Copies the uploaded driver ZIP to the C# project directory (as `CoreStationHX.zip`).
  * Determines effective baseline strings.
  * Invokes `dotnet publish` on the **C# `ConsoleInstaller` project**.
  * During this C# build, MSBuild generates a `GeneratedBuildInfo.cs` file with the provided metadata (product family, product, baselines).
  * The C# application is compiled into a single, self-contained executable, embedding the `CoreStationHX.zip` (which contains the drivers).
  * The `build.sh` script cleans up the temporary `CoreStationHX.zip` from the C# project directory.
5. The backend informs the frontend of the build status and provides information to construct a download link for the generated executable.
6. The user can then download the custom-built executable from the React frontend.
### Important Notes
* **Firewall:** Ensure that the ports used by the backend (default `3001`) and the frontend dev server (default `5173`) are open for incoming connections on your server's firewall if you're accessing them from other machines.
* **Paths in `server.js`:** The backend script `server.js` uses relative paths to locate the scripts directory and define a `REPO_ROOT_FOR_SCRIPT`. If you change the directory structure, these paths might need adjustment.
* **C# Project:** The `ConsoleInstaller.csproj` is configured to generate `GeneratedBuildInfo.cs` based on MSBuild properties passed by `build.sh`. Any changes to these property names must be reflected in both `build.sh` and `.csproj`.
* **Security:** The provided backend code includes basic sanitization examples for download paths. For a production environment, all user inputs passed to the backend and subsequently to shell scripts should be rigorously validated and sanitized to prevent vulnerabilities like command injection.

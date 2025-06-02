#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
# These would ideally be passed as arguments or environment variables by the CI system/web UI
APP_NAME="${1:-MyConsoleApp}"
VERSION="${2:-1.0.0.0}"
COMPANY="${3:-My Company}"
PRODUCT_ARG="${4:-My Product Installer}"
COPYRIGHT_TEXT="${5:-Copyright © $(date +%Y) My Company}"
TRADEMARK_TEXT="${6:-My Trademark}" # Note: Trademark usually set via AssemblyInfo or Fody
DESCRIPTION_TEXT="${7:-A console application.}"
DRIVER_ZIP_UPLOAD_PATH="${8}" # Path to the ZIP file uploaded by the user
TARGET_RUNTIME="${9:-win-x64}" # e.g., win-x64, linux-x64, osx-x64

PRODUCT_FAMILY="${10:-Host (CoreStation)}"
SELECTED_PRODUCT="${11:-HX2000}"
BASELINE_DATE_INPUT="${12:-UNDATED}"

# Project specific paths (adjust as needed)
# Assume this script is in a 'scripts' directory at the root of the cloned git repo
# And the C# project is in a subdirectory, e.g., "ConsoleInstaller"
# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$(dirname "$SCRIPT_DIR")" # Assumes script is in a 'scripts' subdir

PROJECT_DIR_NAME="ConsoleInstaller" # The name of your C# project's directory
PROJECT_DIR="$REPO_ROOT/$PROJECT_DIR_NAME"
CSPROJ_FILE_NAME="Console Installer.csproj" # Adjust to your .csproj file name
CSPROJ_FILE="$PROJECT_DIR/$CSPROJ_FILE_NAME"

OUTPUT_DIR_BASE="$REPO_ROOT/build_output" # Base directory for all builds
BUILD_TIMESTAMP=$(date +%Y%m%d%H%M%S)
# Sanitize APP_NAME and VERSION for directory naming if they contain spaces or special chars
SAFE_APP_NAME=$(echo "$APP_NAME" | tr -cd '[:alnum:]._-')
SAFE_VERSION=$(echo "$VERSION" | tr -cd '[:alnum:]._-')
OUTPUT_DIR="$OUTPUT_DIR_BASE/${SAFE_APP_NAME}-${SAFE_VERSION}-${TARGET_RUNTIME}-${BUILD_TIMESTAMP}"
FINAL_EXECUTABLE_NAME="$APP_NAME" # .exe will be added automatically for Windows RIDs

EFFECTIVE_BASELINE="Unknown Baseline"
# EFFECTIVE_CURRENT_BASELINE_REG_VAL="0.0.0.UNKNOWN"

NORM_PRODUCT_FAMILY=$(echo "$PRODUCT_FAMILY" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]()')
NORM_SELECTED_PRODUCT=$(echo "$SELECTED_PRODUCT" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]()')

if [ "$NORM_PRODUCT_FAMILY" == "hostcorestation" ]; then
    if [ "$NORM_SELECTED_PRODUCT" == "rx360" ]; then
        EFFECTIVE_BASELINE="CoreStation RX360 Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}.${NORM_SELECTED_PRODUCT^^}-${BASELINE_DATE_INPUT}"
    elif [ "$NORM_SELECTED_PRODUCT" == "cx6620" ]; then
	EFFECTIVE_BASELINE="CoreStation CX6620 Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}.${NORM_SELECTED_PRODUCT^^}-${BASELINE_DATE_INPUT}"
    elif [ "$NORM_SELECTED_PRODUCT" == "hx2000" ]; then
	EFFECTIVE_BASELINE="CoreStation HX2000 Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}.${NORM_SELECTED_PRODUCT^^}-${BASELINE_DATE_INPUT}"
    else
	EFFECTIVE_BASELINE="CoreStation ${SELECTED_PRODUCT} Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}.${NORM_SELECTED_PRODUCT^^}-${BASELINE_DATE_INPUT}"
    fi
elif [ "$NORM_PRODUCT_FAMILY" == "clientdx" ]; then
    if [ "$NORM_SELECTED_PRODUCT" == "5thgenvpro" ]; then
	EFFECTIVE_BASELINE="5th Gen Client (vPRO) Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}-${BASELINE_DATE_INPUT}-DX17XX"
    elif [ "$NORM_SELECTED_PRODUCT" == "5thgennon-vpro" ]; then
	EFFECTIVE_BASELINE="5th Gen Client (non-vPRO) Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}-${BASELINE_DATE_INPUT}-DX15XX"
    elif [ "$NORM_SELECTED_PRODUCT" == "dx1600" ]; then
	EFFECTIVE_BASELINE="DX1600 Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}.DX1600-${BASELINE_DATE_INPUT}"
    else
	EFFECTIVE_BASELINE="Client DX ${SELECTED_PRODUCT} Baseline ($BASELINE_DATE_INPUT)"
	EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}.${NORM_SELECTED_PRODUCT}-${BASELINE_DATE_INPUT}"
    fi
else
    EFFECTIVE_BASELINE="${PRODUCT_FAMILY} ${SELECTED_PRODUCT} Generic Baseline ($BASELINE_DATE_INPUT)"
    EFFECTIVE_CURRENT_BASELINE_REG_VAL="${VERSION}.GENERIC-${BASELINE_DATE_INPUT}"
fi

# --- Pre-build Checks ---
echo "--- Starting Build Process ---"
echo "Application Name: $APP_NAME"
echo "Version: $VERSION"
echo "Product Family: $PRODUCT_FAMILY"
echo "Selected Product: $SELECTED_PRODUCT"
echo "Baseline Date: $BASELINE_DATE_INPUT"
echo "Effective Baseline Name: $EFFECIVE_BASELINE"
echo "Effective Baseline Reg: $EFFECTIVE_CURRENT_BASELINE_REG_VAL"
echo "Target Runtime: $TARGET_RUNTIME"
echo "Project Directory: $PROJECT_DIR"
echo "Output Directory: $OUTPUT_DIR"

if [ -z "$DRIVER_ZIP_UPLOAD_PATH" ]; then
  echo "Error: Path to driver ZIP file not provided (Argument 8)."
  exit 1
fi
if [ ! -f "$DRIVER_ZIP_UPLOAD_PATH" ]; then
  echo "Error: Driver ZIP file not found at '$DRIVER_ZIP_UPLOAD_PATH'."
  exit 1
fi
if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: Project directory '$PROJECT_DIR' not found. Check PROJECT_DIR_NAME and script location."
  exit 1
fi
if [ ! -f "$CSPROJ_FILE" ]; then
  echo "Error: C# project file '$CSPROJ_FILE' not found. Check CSPROJ_FILE_NAME."
  exit 1
fi

# --- Prepare files ---
echo "--- Preparing Files ---"
INTERNAL_DRIVER_ZIP_NAME="CoreStationHX.zip"
DEST_DRIVER_ZIP_PATH="$PROJECT_DIR/$INTERNAL_DRIVER_ZIP_NAME"

echo "Copying driver ZIP from '$DRIVER_ZIP_UPLOAD_PATH' to '$DEST_DRIVER_ZIP_PATH'..."
cp "$DRIVER_ZIP_UPLOAD_PATH" "$DEST_DRIVER_ZIP_PATH"
if [ $? -ne 0 ]; then
  echo "Error: Failed to copy driver ZIP."
  exit 1
fi
echo "Driver ZIP copied."

echo "DEBUG: VERSION input to script = $VERSION"
echo "DEBUG: BASELINE_DATE_INPUT input to script = $BASELINE_DATE_INPUT"
echo "DEBUG: NORM_PRODUCT_FAMILY = $NORM_PRODUCT_FAMILY"
echo "DEBUG: NORM_SELECTED_PRODUCT = $NORM_SELECTED_PRODUCT"
echo "DEBUG: Computed EFFECTIVE_CURRENT_BASELINE_REG_VAL = $EFFECTIVE_CURRENT_BASELINE_REG_VAL"
echo "DEBUG: MSBuild property being passed: -p:EffectiveCurrentBaselineRegVal=\"$EFFECTIVE_CURRENT_BASELINE_REG_VAL\""

# --- Build ---
echo "--- Building C# Project ---"
# Ensure .NET SDK is installed and in PATH on the Linux CI server
# The -p: properties override values in the .csproj file.
# For metadata, it's best if the .csproj <PropertyGroup> already defines them, and these -p values update them.

# Create output directory
mkdir -p "$OUTPUT_DIR"

dotnet publish "$CSPROJ_FILE" \
  --configuration Release \
  --runtime "$TARGET_RUNTIME" \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:AssemblyName="$FINAL_EXECUTABLE_NAME" \
  -p:Version="$VERSION" \
  -p:FileVersion="$VERSION" \
  -p:AssemblyVersion="$VERSION" \
  -p:InformationalVersion="$VERSION" \
  -p:Company="$COMPANY" \
  -p:Product="$PRODUCT" \
  -p:Copyright="$COPYRIGHT_TEXT" \
  -p:Description="$DESCRIPTION_TEXT" \
  -p:ProductFamily="$PRODUCT_FAMILY" \
  -p:SelectedProduct="$SELECTED_PRODUCT" \
  -p:EffectiveBaseline="$EFFECTIVE_BASELINE" \
  -p:EffectiveCurrentBaselineRegVal="$EFFECTIVE_CURRENT_BASELINE_REG_VAL" \
  -p:DriverPackZipForEmbedding="$INTERNAL_DRIVER_ZIP_NAME" \
  -p:IncludeSourceRevisionInInformationalVersion=false \
  --output "$OUTPUT_DIR"

if [ $? -ne 0 ]; then
  echo "Error: dotnet publish failed."
  # Cleanup temporary driver zip even on failure
  echo "Cleaning up '$DEST_DRIVER_ZIP_PATH'..."
  rm -f "$DEST_DRIVER_ZIP_PATH"
  exit 1
fi
echo ".NET publish successful."

# --- Post-build Cleanup ---
echo "--- Post-build Cleanup ---"
echo "Deleting temporary '$DEST_DRIVER_ZIP_PATH'..."
rm -f "$DEST_DRIVER_ZIP_PATH"
echo "Cleanup successful."

echo "--- Build Complete ---"
echo "Output executable(s) available in: $OUTPUT_DIR"
ls -l "$OUTPUT_DIR"

# The CI server or web backend would then make the contents of $OUTPUT_DIR available for download.
# The exact name of the executable will be $FINAL_EXECUTABLE_NAME or $FINAL_EXECUTABLE_NAME.exe (if windows RID)

exit 0

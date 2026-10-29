# Change Log

All notable changes to the "vs-verilog" extension will be documented in this file.

## v0.3.2
### Fixed:
- Fixed Quartus compile commands for Windows vs. Linux.

## v0.3.1
### Fixed:
- Fixed how paths are used in the terminal for Quartus and ModelSim commands.
- Updated README with project changes.
- Small fix to syntax highlighting.

## v0.3.0
### Added:
- Tested and added ability to flash and compile and flash Quartus projects to an FPGA.

## v0.2.4
### Added:
- Added an extension button to download the latest version of VS-Verilog.
- Begun development on a button to also flash to the FPGA.

## v0.2.3
### Fixed:
- Switched to using file name instead of file path for Quartus compilation
- Fixed missing syntax highlighting on single-character variables

### Changed:
- Updated `README.md` information to better reflect extension features
- Updated`CHANGELOG.md` to use a more consistent format

### Added:
- Added changelog information to release notes

### Removed:
- Removed changelog from `README.md` to reduce redundancy

## 0.2.2
### Fixed:
- Wrapped file path in quotes to prevent issues with paths that have spaces.  

## 0.2.1
### Fixed:
- Added extension entrypoint for Modelsim files.

## 0.2.0
### Added:
- Added some basic syntax highlighting for ModelSim `.do` files
- Added the ability to press the "Run" button to open ModelSim and start the simulation

## 0.1.2
### Fixed:
- Removed syntax validation (for now).

## 0.1.1
### Fixed:
- Outdated `package.json` build command.
- Restored syntax error-checking
- Began utilizing `CHANGELOG.md`

## 0.1.0
Added Intel Quartus compilation for convenience. The extension will use whatever `.qpf` file is closest to your currently opened `.sv` file so that you can have multiple open projects simultaneously if you wish.

## 0.0.7
Forced code snippets to be the top suggestion.

## 0.0.6
Adding code snippets and adding package.yml for extension packaging.

## 0.0.5
Fixed auto-indentation for begin/end and similar blocks.

## 0.0.4
Added more granular scopes, switched from auto theme switching to using predefined token scopes to allow compatability with normal themes.

## 0.0.3
Fixed an erroneous `missing semicolon` error.

## 0.0.2
Automated theme switching for convenience.

## 0.0.1
Basic working features implemented.
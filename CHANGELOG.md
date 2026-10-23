# Change Log

All notable changes to the "vs-verilog" extension will be documented in this file.

### 0.2.1
Bugfix:
- Added extension entrypoint for Modelsim files.

### 0.2.0
Features:
- Added some basic syntax highlighting for ModelSim `.do` files
- Added the ability to press the "Run" button to open ModelSim and start the simulation

### 0.1.2
Minor bug fix:
- Removed syntax validation (for now).

### 0.1.1
Minor bug fixes:
- Outdated `package.json` build command.
- Restored syntax error-checking
- Began utilizing `CHANGELOG.md`

### 0.1.0
Added Intel Quartus compilation for convenience. The extension will use whatever `.qpf` file is closest to your currently opened `.sv` file so that you can have multiple open projects simultaneously if you wish.

### 0.0.7
Forced code snippets to be the top suggestion.

### 0.0.6
Adding code snippets and adding package.yml for extension packaging.

### 0.0.5
Fixed auto-indentation for begin/end and similar blocks.

### 0.0.4
Added more granular scopes, switched from auto theme switching to using predefined token scopes to allow compatability with normal themes.

### 0.0.3
Fixed an erroneous `missing semicolon` error.

### 0.0.2
Automated theme switching for convenience.

### 0.0.1
Basic working features implemented.
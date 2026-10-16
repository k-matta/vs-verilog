# vs-verilog

This extension is designed to improve the experience of editing SystemVerilog inside of VS Code. The goal is for it to be a lightweight and simple way to improve basic quality of life.

## Features
### Syntax Highlighting:
The extension is designed with basic syntax highlighting for keywords, variables, numbers, etc. Begin-end (and module-endmodule and case-endcase) blocks are colour-coded the same way brackets are in most other languages for readability and debugging.

### Lightweight Syntax Checking
The extension also implements some basic syntax checking including looking for missing semicolons and verifying that numbers are properly defined (i.e., only 0 and 1 used in binary and enough bits allocated for the desired value).

### Quartus Compilation:
The extension utilizes the Quartus CLI to add SystemVerilog compilation directly within VS Code. Simply open a `.sv` file and press the run arrow at the top-right corner to begin compiling. The script automatically locates the `.qpf` file that is closest to the currently opened file so you can have multiple projects open in the same editor if you need to.

## Usage Instructions
Run `curl -L -O https://github.com/k-matta/vs-verilog/releases/latest/download/vs-verilog-v0.0.6.vsix && code --uninstall-extension karl.vs-verilog & code --install-extension $(ls -1rf --sort=version | grep vs-verilog | head -n 1 | xargs -d '\n')` in the directory you want to store the extension in.
Then, if it does not appear in your extension list, click the three dots at the top-right of the extensions panel and choose `Install from VSIX...`.
Open a `.v` or `.sv` file. If you do not see syntax highlighting automatically applied, click `Plain Text` at the bottom right of the screen, then choose `Configure file association for '.sv'...` and choose `SystemVerilog` from the list.

> # A Note on Compiling:
> To use compilation features, note that you will need to have the Quartus `bin` folder from your install directory added to your terminal `PATH` so that VS Code can use it.

## Release Notes

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
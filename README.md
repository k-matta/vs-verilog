# vs-verilog

This extension is designed to improve the experience of editing SystemVerilog inside of VS Code. The goal is for it to be a lightweight and simple way to improve basic quality of life.

## Features
### Syntax Highlighting:
The extension is designed with basic syntax highlighting for keywords, variables, numbers, etc. Begin-end (and module-endmodule and case-endcase) blocks are colour-coded the same way brackets are in most other languages for readability and debugging.

### Lightweight Syntax Checking
The extension also implements some basic syntax checking including looking for missing semicolons and verifying that numbers are properly defined (i.e., only 0 and 1 used in binary and enough bits allocated for the desired value).

## Requirements
For simplicity, the extension comes preloaded with all required modules and files.

## Release Notes

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
# vs-verilog

This extension is designed to improve the experience of editing SystemVerilog inside of VS Code. The goal is for it to be a lightweight and simple way to improve basic quality of life.

## Features
### Syntax Highlighting:
The extension is designed with basic syntax highlighting for keywords, variables, numbers, etc. in SystemVerilog. For convenience, `begin-end` (and `module-endmodule` and `case-endcase`) blocks are colour-coded the same way brackets are in most other languages. There is also some very basic syntax highlighting for ModelSim TCL at the moment with plans to make it more extensive in the future.

### Quartus Compilation and ModelSim Shortcut:
The extension utilizes the Quartus CLI to add SystemVerilog compilation directly within VS Code. Simply open a `.sv` file and press the run arrow at the top-right corner to begin compiling. The script automatically locates the `.qpf` file that is closest to the currently opened file so you can have multiple projects open in the same editor if you need to.
The extension also uses the ModelSim CLI to open ModelSim and run `.do` files for convenience.

## Usage Instructions
Run `curl -L -O https://github.com/k-matta/vs-verilog/releases/latest/download/vs-verilog-v0.0.6.vsix && code --uninstall-extension karl.vs-verilog & code --install-extension $(ls -1rf --sort=version | grep vs-verilog | head -n 1 | xargs -d '\n')` in the directory you want to store the extension in.
Then, if it does not appear in your extension list, click the three dots at the top-right of the extensions panel and choose `Install from VSIX...`.
Open a `.v` or `.sv` file. If you do not see syntax highlighting automatically applied, click `Plain Text` at the bottom right of the screen, then choose `Configure file association for '.sv'...` and choose `SystemVerilog` from the list.

> # A Note on Compiling:
> To use compilation features, note that you will need to have the Quartus `bin` folder from your install directory added to your terminal `PATH` so that VS Code can use it.
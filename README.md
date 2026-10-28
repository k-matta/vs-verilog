# vs-verilog

This extension is designed to improve the experience of editing SystemVerilog inside of VS Code. The goal is for it to be a lightweight and simple way to improve basic quality of life.

## Features
### Syntax Highlighting:
The extension is designed with basic syntax highlighting for keywords, variables, numbers, etc. in SystemVerilog. For convenience, `begin-end` (and `module-endmodule` and `case-endcase`) blocks are colour-coded the same way brackets are in most other languages. There is also some very basic syntax highlighting for ModelSim TCL at the moment with plans to make it more extensive in the future.

### Quartus Compilation and ModelSim Shortcut:
The extension utilizes the Quartus CLI to add SystemVerilog compilation directly within VS Code. Simply open a `.sv` file and press the run arrow at the top-right corner to begin compiling. The script automatically locates the `.qpf` file that is closest to the currently opened file so you can have multiple projects open in the same editor if you need to.
The extension also uses the ModelSim CLI to open ModelSim and run `.do` files for convenience.

## Usage Instructions
### Installation:
#### Windows:
```powershell  
$RELEASE=$(Invoke-WebRequest -Uri "https://api.github.com/repos/k-matta/vs-verilog/releases/latest" -UseBasicParsing | ConvertFrom-Json).assets[0].name | tr -d '"'; Invoke-WebRequest -Uri "https://github.com/k-matta/vs-verilog/releases/latest/download/$RELEASE" -OutFile "./$RELEASE" -UseBasicParsing
````
#### Linux:
```bash
RELEASE=$(curl -s https://api.github.com/repos/k-matta/vs-verilog/releases/latest | jq ".assets[0].name" | tr -d '"') && curl -L -O "https://github.com/k-matta/vs-verilog/releases/latest/download/$RELEASE"
```
#### Both:
The above command will install the extension to your current directory. You can then click the three dots at the top-right of the extensions panel and choose `Install from VSIX...` to add it to VS Code.
Open a `.v` or `.sv` file. If you do not see syntax highlighting automatically applied, click `Plain Text` at the bottom right of the screen, then choose `Configure file association for '.sv'...` and choose `SystemVerilog` from the list.

### Updating the Extension:
Once the extension is installed, it can be updated by clicking the dropdown next to the run arrow and choosing "Update VS-Verilog". This downloads the latest version to your Downloads folder. You can then add the new version to VS Code using the same steps as installation.

> # A Note on Compiling:
> To use compilation and simulation features, note that you will need to have the Quartus and/or ModelSim `bin` folder from your install directory added to your terminal `PATH` so that VS Code can use it.
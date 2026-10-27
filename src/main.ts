import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	// 1. Create a collection to hold your syntax errors
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('systemverilog');
	context.subscriptions.push(diagnosticCollection);

	let runSim = vscode.commands.registerCommand('modelsim.runFile', () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor || !activeEditor.document) {
			vscode.window.showErrorMessage("No editor open. Please open a ModelSim '.do' file to run the simulation.");
			return;
		}
		let terminal = vscode.window.terminals.find(t => t.name === "ModelSim Simulation") || vscode.window.createTerminal("ModelSim Simulation");
		terminal.show();
		terminal.sendText(`cd "${activeEditor.document.uri.fsPath}"`);
		terminal.sendText(`vsim -do "${activeEditor.document.fileName}"`);
	});
	context.subscriptions.push(runSim);

	let runSyn = vscode.commands.registerCommand('systemverilog.compile', async () => {
		const output = await getQuartusProject();
		if (!output) {
			return;
		}
		const {fileDir, fileName} = output;
		let terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.createTerminal("Quartus Compile");
		terminal.show();
		terminal.sendText(`cd "${fileDir}"`);
		terminal.sendText(`quartus_sh --flow compile "${fileName}"`);
	});
	context.subscriptions.push(runSyn);

	let synAndFlash = vscode.commands.registerCommand('systemverilog.compileAndFlashFile', async () => {
		const output = await getQuartusProject();
		if (!output) {
			return;
		}
		const {fileDir, fileName} = output;
		let terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.createTerminal("Quartus Compile");
		terminal.show();
		terminal.sendText(`cd "${fileDir}"`);
		terminal.sendText(`quartus_sh --flow compile "${fileName}"`);
		terminal.sendText(`quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;output_files/${fileName.slice(0, fileName.indexOf('.'))}.sof"`);
	});
	context.subscriptions.push(synAndFlash);

	let flashCode = vscode.commands.registerCommand('systemverilog.flashFile', async () => {
		const output = await getQuartusProject();
		if (!output) {
			return;
		}
		const {fileDir, fileName} = output;
		let terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.terminals.find(t => t.name === "Quartus Flash") || vscode.window.createTerminal("Quartus Flash");
		terminal.show();
		terminal.sendText(`cd "${fileDir}"`);
		terminal.sendText(`quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;output_files/${fileName.slice(0, fileName.indexOf('.'))}.sof"`);
	});
	context.subscriptions.push(flashCode);

	let downlaodNew = vscode.commands.registerCommand('update', async () => {
		let terminal;
		const OS = process.platform;
		if (OS == "win32")  {
			terminal = vscode.window.createTerminal("Powershell", "powershell");
			terminal.show();
			terminal.sendText(`cd ~/Downloads`);
			terminal.sendText(`$RELEASE=$(Invoke-WebRequest -Uri "https://api.github.com/repos/k-matta/vs-verilog/releases/latest" -UseBasicParsing | ConvertFrom-Json).assets[0].name | tr -d '"'; Invoke-WebRequest -Uri "https://github.com/k-matta/vs-verilog/releases/latest/download/$RELEASE" -OutFile "./$RELEASE" -UseBasicParsing`)
		} else {
			terminal = vscode.window.createTerminal("bash", 'bash');
			terminal.show();
			terminal.sendText(`cd ~/Downloads`);
			terminal.sendText(`RELEASE=$(curl -s https://api.github.com/repos/k-matta/vs-verilog/releases/latest | jq ".assets[0].name" | tr -d '"') && curl -L -O "https://github.com/k-matta/vs-verilog/releases/latest/download/$RELEASE"`);
		}
		terminal.sendText('echo "Please open the Extensions Menu => 3 dots at the top => Install from VSIX... => Select the most recent version (in your \'Downloads\' folder)."');
	});
	context.subscriptions.push(downlaodNew);
}

async function getQuartusProject() {
	const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor || !activeEditor.document) {
			vscode.window.showErrorMessage("No editor open. Please open a SystemVerilog project file to compile.");
			return;
		}

		console.log(activeEditor)
		
		const files = await vscode.workspace.findFiles('**/*.qpf');
		
		console.log(files)
		if (!files || files.length === 0) {
			vscode.window.showErrorMessage("No .qpf files found in the workspace.");
			return;
		}
		
		let targetFileUri: vscode.Uri;
		
		if (files.length === 1) {
			targetFileUri = files[0];
		} else {
			const referencePath = activeEditor.document.uri.fsPath;
			targetFileUri = findClosestFile(referencePath, files);
		}
		
		console.log(targetFileUri)
		await vscode.workspace.saveAll(false);

		const filePath = targetFileUri.fsPath;
		const fileDir = path.dirname(filePath);
		const fileName = filePath.split("/")[filePath.split("/").length-1];
		return {fileDir, fileName};
}

// function validateDocument(document: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
// 	// if (!document || !document.uri || document.uri.scheme !== 'file') { return; }
// 	if (document.languageId !== 'systemverilog') { return; }

// 	const diagnostics: vscode.Diagnostic[] = [];
// 	const text = document.getText();

// 	const variable = /[A-Za-z_0-9]+/;
// 	const direction = /input|output|inout/;
// 	const assignment = /(enum )?(assign|logic|parameter|integer|variable|wire|enum)/;
// 	const control = /if|when|always|always_ff|always_comb|else|begin|end/;
// 	const anyStart = new RegExp(`${assignment.source}|${direction.source}|${control.source}`);
// 	// 3. RUN YOUR PARSER HERE
// 	let regex = new RegExp(`(^(?!//))\\b(${assignment.source})[^;=]*?(<)?=(\\s)*?(;|${anyStart.source}|\n)`, 'g');
// 	let match;

// 	while ((match = regex.exec(text)) !== null) {
// 		console.log(match[0]);
// 		const startPos = document.positionAt(match.index);
// 		const endPos = document.positionAt(match.index + match[0].length);
// 		const range = new vscode.Range(startPos, endPos);

// 		const diagnostic = new vscode.Diagnostic(
// 			range,
// 			'Syntax Error: Expecting expression.',
// 			vscode.DiagnosticSeverity.Error
// 		);
		
// 		diagnostics.push(diagnostic);
// 	}

// 	regex = new RegExp(`^(?!\\s*//)(?!\\s*/\\*|.*\\*/)(?!\\s*(?:module\\b|begin\\b|end\\b|endmodule\\b|always\\b|initial\\b|if\\b|else\\b|case\\b|endcase\\b|assign\\s+.*=.*;)).*?([^;{,(\\\\\\s])\\s*$`, 'g');
// // 	regex = new RegExp(`(?:^|;)(?:(?!//)[^\\n])*?(?!(?:${direction.source}))\\b(?:${assignment.source})\\b\\s+` + 
// //   `([^;\\n]*?(?:\\d+'[hbo][0-9a-fA-FXxZz_]+|[^;\\n])*?)` +
// //   `(?=\\s*(?:(?:${anyStart.source})|\\n|$))`, "gmd");

// // 	while ((match = regex.exec(text)) !== null) {
// // 		console.log("Assignment:", match[0]);
// // 		console.log("Indices:", match.indices);
// // 		if (!match.indices![2]) {
// // 			continue;
// // 		}
// // 		const startPos = document.positionAt(match.indices![2]![0]);
// // 		const endPos = document.positionAt(match.indices![2]![1]);
// // 		const range = new vscode.Range(startPos, endPos);

// // 		const diagnostic = new vscode.Diagnostic(
// // 			range,
// // 			'Syntax Error: All statements must be terminated by a semicolon.',
// // 			vscode.DiagnosticSeverity.Error
// // 		);
		
// // 		diagnostics.push(diagnostic);
// // 	}

// // 	regex = new RegExp(`^(?!\\s*//)\\s*` +
// //   `(?!(?:(?:${direction.source})|(?:${control.source})|\\(|\\)))` +
// //   `\\b((?:${variable.source}))\\b\\s*` + 
// //   `\\s*(<)?=\\s*` +
// //   `([^;\\n]+?)(?:\\d+'[hbo][0-9a-fA-FXxZz_]+|[^;\\n])*?)` + 
// //   `(?=\\s*(?!;)(?:\\b(?:(?:${direction.source})|(?:${control.source})|(?:${variable.source}))\\b|\\n|$))`, "gm");

// 	while ((match = regex.exec(text)) !== null) {
// 		console.log("Generic:", match);
// 		const startPos = document.positionAt(match.index);
// 		const endPos = document.positionAt(match.index + match[0].length);
// 		const range = new vscode.Range(startPos, endPos);

// 		const diagnostic = new vscode.Diagnostic(
// 			range,
// 			'Syntax Error: All statements must be terminated by a semicolon.',
// 			vscode.DiagnosticSeverity.Error
// 		);
		
// 		diagnostics.push(diagnostic);
// 	}

// 	regex = new RegExp(`(^(?!//))(^\\b|,\\b)((?:${direction.source})(?:${assignment.source})[^,\\n\\)]+)(?=\\n\\s*(?:${direction.source}))`, "gd");
	
// 	while ((match = regex.exec(text)) !== null) {
// 		console.log("Generic:", match[0]);
// 		const startPos = document.positionAt(match.indices![2]![0]);
// 		const endPos = document.positionAt(match.indices![2]![1]);
// 		const range = new vscode.Range(startPos, endPos);
		
// 		const diagnostic = new vscode.Diagnostic(
// 			range,
// 			'Syntax Error: Expecting a comma.',
// 			vscode.DiagnosticSeverity.Error
// 		);
		
// 		diagnostics.push(diagnostic);
// 	}

// 	regex = /(^(?!\/\/))(?!')(.+?)\d+'(.+?)/g;

// 	while ((match = regex.exec(text)) !== null) {
// 		const value = match[3];
// 		if (!value) {
// 			continue;
// 		}
// 		if ((/[(b|o|d|h)]/g.exec(value[0])) !== null) {
// 			const startPos = document.positionAt(match.index);
// 			const endPos = document.positionAt(match.index+match.length);
// 			const range = new vscode.Range(startPos, endPos);
// 			const diagnostic = new vscode.Diagnostic(
// 				range,
// 				`Syntax Error: Expected base specifier ('b', 'o', 'd', or 'h').`,
// 				vscode.DiagnosticSeverity.Error
// 			);
// 			diagnostics.push(diagnostic);
// 		}
// 	}

// 	regex = /(^(?!\/\/))(\d+)'(b|o|d|h)([0-9]+?)\b/g;

// 	while ((match = regex.exec(text)) !== null) {
// 		const bits = match[1];
// 		const type = match[2];
// 		const value = match[3];
// 		let error = "";
// 		let base = 0;
// 		let tempMatch;
// 		switch (type) {
// 			case 'b':
// 				if ((tempMatch = /[^01]/g.exec(value)) !== null) {
// 					error = "Binary values can only contain 0 or 1";
// 				}
// 				base = 2;
// 				break;
// 			case 'o':
// 				if ((tempMatch = /[^0-7]/g.exec(value)) !== null) {
// 					error = "Octal values can only contain digits 0-7";
// 				}
// 				base = 8;
// 				break;
// 			case 'd':
// 				if ((tempMatch = /[^0-9]/g.exec(value)) !== null) {
// 					error = "Decimal values can only contain digits 0-9";
// 				}
// 				base = 10;
// 				break;
// 			case 'h':
// 				if ((tempMatch = /[^0-9A-Fa-f]/g.exec(value)) !== null) {
// 					error = "Hexadecimal values can only contain symbols 0-F";
// 				}
// 				base = 16;
// 				break;
// 		}
		
		
// 		if (tempMatch){
// 			const startPos = document.positionAt(tempMatch.index+match.index+bits.length+2);
// 			const endPos = document.positionAt(tempMatch.index+match.index+bits.length+2 + value.length);
// 			const range = new vscode.Range(startPos, endPos);
// 			const diagnostic = new vscode.Diagnostic(
// 				range,
// 				`Syntax Error: ${error}.`,
// 				vscode.DiagnosticSeverity.Error
// 			);
// 			diagnostics.push(diagnostic);
// 		} else {
// 			const numericVal = parseInt(value, base);
// 			if (numericVal > (2**parseInt(bits, 10)-1)) {
// 				const startPos = document.positionAt(match.index);
// 				const endPos = document.positionAt(match.index + match[0].length);
// 				const range = new vscode.Range(startPos, endPos);
// 				const diagnostic = new vscode.Diagnostic(
// 					range,
// 					`Syntax Error: Size of value exceeds maximum possible value for this number of bits.`,
// 					vscode.DiagnosticSeverity.Error
// 				);
// 				diagnostics.push(diagnostic);
// 			}
// 		}
// 	}

// 	// 4. Update the editor with the squiggles
// 	collection.set(document.uri, diagnostics);
// }

function findClosestFile(referencePath: string, fileUris: vscode.Uri[]): vscode.Uri {
	if (!fileUris || !Array.isArray(fileUris) || fileUris.length === 0) {
		throw new Error("File-matching array is empty or undefined.");
	}
	let closestUri = fileUris[0];
	let minDistance = Infinity;
	
	for (const uri of fileUris) {
		const relativePath = path.relative(referencePath, uri.fsPath);
		const hops = relativePath.split(path.sep).filter((segment: String) => segment !== '' && segment !== '.').length;
		if (hops < minDistance) {
			minDistance = hops;
			closestUri = uri;
		}
	}

	return closestUri;
}
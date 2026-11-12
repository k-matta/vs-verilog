import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from "os";

let updateCheck = false;

export function activate(context: vscode.ExtensionContext) {
	// 1. Create a collection to hold your syntax errors
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('systemverilog');
	context.subscriptions.push(diagnosticCollection);

	const OS = process.platform;
	const config = vscode.workspace.getConfiguration('vs-verilog');

	const rawDownloadDir = config.get<string>("downloadDir", "~/Downloads");
	console.log(`---------------------\nDownload Dir: ${rawDownloadDir}\n------------------`)
	let downloadDir;
	if (rawDownloadDir.startsWith("~")) {
		downloadDir = path.join(os.homedir() + rawDownloadDir.slice(1));
	} else downloadDir = rawDownloadDir;
	console.log(`---------------------\nDownload Dir: ${downloadDir}\n------------------`)

	const [rootFolderUri, rootFolderPath] = getRootFolder();
	console.log(`Project Root Path: ${rootFolderPath}`);

	if (!updateCheck) {
		update(context, config, OS, downloadDir, false);
		updateCheck = true;
	}

	let runSim = vscode.commands.registerCommand('modelsim.runFile', () => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor || !activeEditor.document) {
			vscode.window.showErrorMessage("No editor open. Please open a ModelSim '.do' file to run the simulation.");
			return;
		}
		let terminal = vscode.window.terminals.find(t => t.name === "ModelSim Simulation") || vscode.window.createTerminal("ModelSim Simulation");
		terminal.show();
		let path;
		let file;
		if (OS == "win32") {
			path = activeEditor.document.fileName.split("\\").slice(0, activeEditor.document.fileName.split("\\").length - 1).join("\\");
			file = activeEditor.document.fileName.split("\\")[activeEditor.document.fileName.split("\\").length - 1];
		} else {
			path = activeEditor.document.fileName.split("/").slice(0, activeEditor.document.fileName.split("/").length - 1).join("/");
			file = activeEditor.document.fileName.split("/")[activeEditor.document.fileName.split("/").length - 1];
		}
		console.log(OS, path, file);
		terminal.sendText(`cd "${path}"`);
		terminal.sendText(`vsim -do "${file}"`);
	});
	context.subscriptions.push(runSim);

	let runSyn = vscode.commands.registerCommand('systemverilog.compile', async () => {
		const output = await getQuartusProject();
		if (!output) {
			return;
		}
		const { fileDir, fileName } = output;
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
		const { fileDir, fileName } = output;
		let terminal;
		if (OS == "win32")
			terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.createTerminal("Quartus Compile", "powershell");
		else terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.createTerminal("Quartus Compile", "bash");
		terminal.show();
		terminal.sendText(`cd "${fileDir}"`);
		terminal.sendText(`quartus_sh --flow compile "${fileName}"`);
		if (OS == "win32") terminal.sendText(`if ("$LASTEXITCODE") { Write-Output "ERROR: Cannot compile due to build errors." } else { quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;output_files/${fileName.slice(0, fileName.indexOf('.'))}.sof" }`);
		else terminal.sendText(`[ $? -eq 0 ] && quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;output_files/${fileName.slice(0, fileName.indexOf('.'))}.sof" || echo "ERROR: Cannot compile due to build errors."`);
		if (rootFolderPath) terminal.sendText(`cd "${rootFolderPath}`);
	});
	context.subscriptions.push(synAndFlash);

	let flashCode = vscode.commands.registerCommand('systemverilog.flashFile', async () => {
		const output = await getQuartusProject();
		if (!output) {
			return;
		}
		const { fileDir, fileName } = output;
		let terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.terminals.find(t => t.name === "Quartus Flash") || vscode.window.createTerminal("Quartus Flash");
		terminal.show();
		terminal.sendText(`cd "${fileDir}"`);
		terminal.sendText(`quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;output_files/${fileName.slice(0, fileName.indexOf('.'))}.sof"`);
		if (rootFolderPath) terminal.sendText(`cd "${rootFolderPath}`);
	});
	context.subscriptions.push(flashCode);

	let updateExtension = vscode.commands.registerCommand('update', async () => {
		await update(context, config, OS, downloadDir, true);
	});
	context.subscriptions.push(updateExtension);
}

async function update(context: vscode.ExtensionContext, config: vscode.WorkspaceConfiguration, OS: string, dir: string, update_override: Boolean) {
	const currentVersion = context.extension.packageJSON.version;
	fetch("https://api.github.com/repos/k-matta/vs-verilog/releases/latest", { "method": "GET" }).then((res) => {
		if (res.status == 200) return res.json();
		else return { "error": "Could not connect to repository." };
	}).then(async (json) => {
		if (json.error) {
			vscode.window.showErrorMessage("There was an error checking for extension updates.");
			return;
		}
		const name = json.assets[0].name;
		const version = name.split("-v")[2].slice(0, name.split("-v")[2].indexOf(".vsix"));
		console.log("Latest: ", version, "\nCurrent: ", currentVersion);
		if ((version.split(".")[0]>currentVersion.split(".")[0]) || (version.split(".")[0]==currentVersion.split(".")[0] && version.split(".")[1]>currentVersion.split(".")[1]) || (version.split(".")[0]==currentVersion.split(".")[0] && version.split(".")[1]==currentVersion.split(".")[1] && version.split(".")[2]>currentVersion.split(".")[2])) {
			if (update_override || config.get<string>("update", "notify") == "install") {
				try {
					// 1. Fetch the file data
					const response = await fetch(`https://github.com/k-matta/vs-verilog/releases/latest/download/${name}`);

					if (!response.ok) {
						throw new Error(`Failed to fetch file: ${response.statusText}`);
					}

					// 2. Convert the response data to an ArrayBuffer
					const arrayBuffer = await response.arrayBuffer();
					const fileData = new Uint8Array(arrayBuffer);

					// 3. Determine where to save it (e.g., the root of the open workspace folder)
					const workspaceFolders = vscode.workspace.workspaceFolders;
					if (!workspaceFolders) {
						vscode.window.showErrorMessage("Open a workspace folder first to save the file.");
						return;
					}

					const targetUri = vscode.Uri.file(path.join(dir, name));
					console.log("Writing file to", targetUri);

					// 4. Write the file to the local disk
					await vscode.workspace.fs.writeFile(targetUri, fileData);
					vscode.window.showInformationMessage(`File downloaded successfully to ${targetUri}`);

					// Install extension
					console.log("Installing from:", `${targetUri}`);
					await vscode.commands.executeCommand('workbench.extensions.installExtension', targetUri);

					// Remove old files
					if (config.get("remove", true)) {
						console.log(`Removing VSIX files from ${dir}`);
						fs.unlinkSync(targetUri.fsPath);
						console.log("Removal complete.")
					}

					context.workspaceState.update("openChanges", `${path.join(os.homedir(), "/.vscode/extensions/", context.extension.packageJSON.publisher.toLowerCase() + "." + name.split("-v").slice(0, 2).join("-v") + "-" + name.split("-v")[2].slice(0, name.split("-v")[2].indexOf(".vsix")), "/changelog.md")}`);

					// Prompt or force a window reload to apply the upgrade
					console.log("Restarting");
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				} catch (e) {
					console.error(e);
					vscode.window.showErrorMessage("Failed to update extension");
				}
			} else if (config.get<string>("update", "notify") == "notify") {
				vscode.window.showInformationMessage("A new version of VS Verilog is available!\nWould you like to update now?", "Update", "Ignore").then(async (action) => {
					if (action == "Update") {
						await update(context, config, OS, dir, true);
					}
				});
			}
		}
		const openChanges = context.workspaceState.get<string>('openChanges');
		console.log(openChanges);
		if (openChanges) {
			// Clear the state immediately so it doesn't keep opening on every future reload
			context.workspaceState.update('openChanges', "");

			// Reopen the saved file path
			const fileUri = vscode.Uri.parse(openChanges);
			console.log("Opening CHANGELOG");
			vscode.commands.executeCommand('markdown.showPreview', fileUri).then(
				(document) => {
					console.log("Showing document and message");
					vscode.window.showInformationMessage(`VS Verilog updated successfully!`);
				}
			);
		}
	});
}

function getRootFolder() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders && workspaceFolders.length > 0) {
		// This gives you the root folder of the first workspace
		return [workspaceFolders[0].uri, workspaceFolders[0].uri.fsPath];
	}
	return [null, null];
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
	const fileName = filePath.split("/")[filePath.split("/").length - 1];
	return { fileDir, fileName };
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
		const hops = relativePath.split(path.sep).filter((segment: string) => segment !== '' && segment !== '.').length;
		if (hops < minDistance) {
			minDistance = hops;
			closestUri = uri;
		}
	}

	return closestUri;
}
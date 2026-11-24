import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'node:fs';
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
		const terminal = vscode.window.terminals.find(t => t.name === "ModelSim Simulation") || vscode.window.createTerminal("ModelSim Simulation");
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
		const output = await getQuartusProject(OS);
		if (!output) {
			return;
		}
		const { fileDir, fileName, outputDir} = output;
		const terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.createTerminal("Quartus Compile", "bash");
		terminal.show();
		setTimeout(() => {
			if (!terminal.shellIntegration) {
				console.log("Shell integration unavailable")
				terminal.sendText(`cd "${fileDir}"`);
				terminal.sendText(`quartus_sh --flow compile "${fileName}"`);
			} else {
				const execution = terminal.shellIntegration.executeCommand(`cd "${fileDir}" && quartus_sh --flow compile "${fileName}"`);
				const disposable = vscode.window.onDidEndTerminalShellExecution((event) => {
					if (event.execution === execution) {
						disposable.dispose();
						if (event.exitCode) {
							vscode.window.showErrorMessage("Quartus Compilation Failed. Please see terminal for errors.");
						} else {
							parseQuartusCompilation(path.join(fileDir, outputDir), fileName.split(".").slice(0, fileName.split(".").length-1).join("."));
						}
					}
				});
			}
		}, 1000);
	});
	context.subscriptions.push(runSyn);

	let synAndFlash = vscode.commands.registerCommand('systemverilog.compileAndFlashFile', async () => {
		const output = await getQuartusProject(OS);
		if (!output) {
			return;
		}
		const { fileDir, fileName, outputDir } = output;
		const terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.createTerminal("Quartus Compile", "bash");
		setTimeout(() => {
			if (!terminal.shellIntegration) {
				terminal.show();
				terminal.sendText(`cd "${fileDir}"`);
				terminal.sendText(`quartus_sh --flow compile "${fileName}"`);
				terminal.sendText(`[ $? -eq 0 ] && quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;${outputDir}/${fileName.slice(0, fileName.indexOf('.'))}.sof" || echo "ERROR: Cannot compile due to build errors."`);
			} else {
				const execution = terminal.shellIntegration.executeCommand(`cd "${fileDir}" && quartus_sh --flow compile "${fileName}"`);
				const disposable = vscode.window.onDidEndTerminalShellExecution((event) => {
					if (event.execution === execution) {
						disposable.dispose();
						if (event.exitCode) {
							vscode.window.showErrorMessage("Quartus Compilation Failed. Please see terminal for errors.");
						} else {
							parseQuartusCompilation(path.join(fileDir, outputDir), fileName.split(".").slice(0, fileName.split(".").length-1).join("."));
							const flash = terminal.shellIntegration?.executeCommand(`quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;${outputDir}/${fileName.slice(0, fileName.indexOf('.'))}.sof"`);
							const flashDispose = vscode.window.onDidEndTerminalShellExecution((flashEvent) => {
								if (flashEvent.execution === flash) {
									if (event.exitCode) {
										vscode.window.showErrorMessage("Flashing to FPGA failed. Please see terminal for errors.");
									}
								}
							});
						}
					}
				})
			}
		}, 1000);
	});
	context.subscriptions.push(synAndFlash);

	let flashCode = vscode.commands.registerCommand('systemverilog.flashFile', async () => {
		const output = await getQuartusProject(OS);
		if (!output) {
			return;
		}
		const { fileDir, fileName, outputDir } = output;
		let terminal = vscode.window.terminals.find(t => t.name === "Quartus Compile") || vscode.window.terminals.find(t => t.name === "Quartus Flash") || vscode.window.createTerminal("Quartus Flash");
		terminal.show();
		terminal.sendText(`cd "${fileDir}"`);
		terminal.sendText(`quartus_pgm -c "$(quartus_pgm -l | grep USB-Blaster | cut -d ' ' -f 2-)" -m JTAG -o "p;${outputDir}/${fileName.slice(0, fileName.indexOf('.'))}.sof"`);
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
		if ((version.split(".")[0] > currentVersion.split(".")[0]) || (version.split(".")[0] == currentVersion.split(".")[0] && version.split(".")[1] > currentVersion.split(".")[1]) || (version.split(".")[0] == currentVersion.split(".")[0] && version.split(".")[1] == currentVersion.split(".")[1] && version.split(".")[2] > currentVersion.split(".")[2])) {
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

					context.workspaceState.update("openChanges", `${path.join(os.homedir(), ".vscode", "extensions", context.extension.packageJSON.publisher.toLowerCase() + "." + name.split("-v").slice(0, 2).join("-v") + "-" + name.split("-v")[2].slice(0, name.split("-v")[2].indexOf(".vsix")), "changelog.md")}`);

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

async function getQuartusProject(OS: string) {
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
	let fileName;
	if (OS == "win32") fileName = filePath.split("\\")[filePath.split("\\").length - 1];
	else fileName = filePath.split("/")[filePath.split("/").length - 1];
	let outputDir;
	const configs = fs.readFileSync(path.join(fileDir, fileName.split(".")[0] + ".qsf"), "utf-8");
	if (configs.indexOf("PROJECT_OUTPUT_DIRECTORY") == -1) outputDir = ".";
	else {
		const configLines = configs.split("\n");
		const outputDirLine = configLines.findIndex((line) => line.indexOf("PROJECT_OUTPUT_DIRECTORY") !== -1);
		console.log(configLines[outputDirLine].slice(configLines[outputDirLine].indexOf("PROJECT_OUTPUT_DIRECTORY") + 25).trim());
		outputDir = configLines[outputDirLine].slice(configLines[outputDirLine].indexOf("PROJECT_OUTPUT_DIRECTORY") + 25).trim();
	}
	return { fileDir, fileName, outputDir };

}

async function parseQuartusCompilation(projectDir: string, projectName: string) {
	try {
		const TA_lines = fs.readFileSync(path.join(projectDir, projectName) + ".sta.rpt", "utf-8").split("\n");
		let HTML = `<!DOCTYPE html>
<html>
<head>
	<title>Quartus Compilation Report</title>
	<style>
		:root {
			interpolate-size: allow-keywords;
		}
		.dropdown {
			transition: all 0.5s ease-in-out;
		}
		.padding {
			background-color: #303030;
			width: 100%;
			height: 30px;
		}
		.dropdown-arrow {
			width: 30px;
			height: 30px;
			padding: 0 0.6rem;
			transition: rotate 0.5s ease-in-out;
			display: inline-block;
			rotate: 180deg;
			filter: invert();
			translate: 0 10px;
		}
		.dropdown-header {
			background-color: #303030;
			position: sticky;
			left: 0;
		}
		h3, h4, h5, h6 {
			margin: 0;
			padding: 0.8rem 0;
			display: inline-block;
		}
		table {
			border-collapse: collapse;
		}
		th, td {
			border: 1.5px solid #aeaeae;
			padding: 10px;
		}
	</style>
</head>
<body>
`;
		let text = "# Quartus Compilation Report:";
		HTML += `
	<h1>Quartus Compilation Report</h1>
	<section class="dropdown">
		<section class="dropdown-header">
			<img class='dropdown-arrow' src='https://cdn-icons-png.flaticon.com/512/3838/3838683.png'>
			<h3>Timing Analysis</h3>
		</section>`
		text += "\n### Timing Analysis:\n";
		const TIMING_REPORTS = ["; Slow 1200mV 85C Model Setup: ", "; Slow 1200mV 85C Model Hold: ", "; Slow 1200mV 0C Model Setup: ", "; Slow 1200mV 0C Model Hold: ", "; Fast 1200mV 0C Model Setup: ", "; Fast 1200mV 0C Model Hold: "]
		for (let report of TIMING_REPORTS) {

			const TA_data_start = TA_lines.findIndex((line) => line.startsWith(report)) + 4;
			HTML += `
		<section class="dropdown">
			<section class="dropdown-header">
				<img class='dropdown-arrow' src='https://cdn-icons-png.flaticon.com/512/3838/3838683.png'>
				<h4>${report.slice(2, -2)}</h4>
			</section>
			<table>
				<thead>
					<tr>
						<th>Slack</th>
						<th>From Node</th>
						<th>To Node</th>
						<th>Launch Clock</th>
						<th>Latch Clock</th>
						<th>Relationship</th>
						<th>Clock Skew</th>
						<th>Data Delay</th>
					</tr>
				</thead>
				<tbody>`
			text += `\n#### ${report.slice(2, -2)}:`;
			text += `\n| Slack | From Node | To Node | Launch Clock | Latch Clock | Relationship | Clock Skew | Data Delay |
| :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: |\n`;
			for (let line of TA_lines.slice(TA_data_start)) {
				if (line.startsWith("+--")) break;
				console.log(line);
				text += line.replaceAll("|", "\\|").replaceAll(" ; ", " | ").replaceAll("; ", "| ").replaceAll(" ;", " |") + "\n";
				HTML += `
						<tr>`;
				for (let cell of line.split(";").slice(1, -1)) {
					HTML += `
							<td>${cell.trim()}</td>`;
				}
				HTML += `
					</tr>`;
			}
			HTML += `
				</tbody>
			</table>
		</section>`;
		}
		HTML += `
	</section>`

		text += "\n### Usage Report:\n";

		const CATEGORIES = ["Logic Cells", "Dedicated Logic Registers", "I/O Registers", "Memory Bits", "M9Ks", "DSP Elements", "DSP 9x9", "DSP 18x18", "Pins", "Virtual Pins", "LUT-Only LCs", "Register-Only LCs", "LUT/Register LCs", "Full Hierarchy Name", "Entity Name", "Library Name"];

		const UR_lines = fs.readFileSync(path.join(projectDir, projectName) + ".fit.rpt", "utf-8").split("\n");
		text += `#### Total Project Usage:\n\n| Category | Usage |\n| :-- | :--: |\n`;
		HTML += `
	<section class='padding'>
	</section>
	<section class="dropdown">
		<section class="dropdown-header">
			<img class='dropdown-arrow' src='https://cdn-icons-png.flaticon.com/512/3838/3838683.png'>
			<h3>Usage Report</h3>
		</section>
		<section class="dropdown">
			<section class="dropdown-header">
				<img class='dropdown-arrow' src='https://cdn-icons-png.flaticon.com/512/3838/3838683.png'>
				<h4>Top-Level Module Usage</h4>
			</section>
			<table>
				<thead>
					<tr>
						<th>Category</th>
						<th>Usage</th>
					</tr>
				</thead>
				<tbody>`;
		const UR_data_start = UR_lines.findIndex((line) => line.startsWith("; Fitter Resource Utilization by Entity")) + 5;
		const projectLine = UR_lines[UR_data_start - 1];
		console.log(UR_lines.slice(UR_data_start-5, UR_data_start+20));
		console.log(UR_data_start, 
			projectLine.slice(projectLine.indexOf(";", projectLine.indexOf(";")+1))
		);
		projectLine.slice(projectLine.indexOf(";", projectLine.indexOf(";")+1)).split(" ; ").slice(0, 13).forEach((category, index) => {
			text += `| ${CATEGORIES[index]} | ${!index ? category.trim().slice(1) : category.trim()} |\n`;
			HTML += `
					<tr>
						<td>${CATEGORIES[index]}</td>
						<td>${!index ? category.trim().slice(1) : category.trim()}</td>
					</tr>`;
		});
		text += "\n\n";
		HTML += `
				</tbody>
			</table>
		</section>`;
		for (let line of UR_lines.slice(UR_data_start)) {
			if (line.startsWith("+--")) break;
			const lineArray = line.slice(line.indexOf(";", line.indexOf(";")+1)).split(" ; ");
			HTML += `
		<section class="dropdown">
			<section class="dropdown-header">
				<img class='dropdown-arrow' src='https://cdn-icons-png.flaticon.com/512/3838/3838683.png'>
				<h4>${lineArray[14].trim() + " Usage"}</h4>
			</section>
			<table>
				<thead>
					<tr>
						<th>Category</th>
						<th>Usage</th>
					</tr>
				</thead>
				<tbody>`
			text += "#### " + lineArray[14].trim() + " Usage:\n\n| Category | Usage |\n| :-- | :--: |\n";
			lineArray.slice(0, 13).forEach((category, index) => {
				text += `| ${CATEGORIES[index]} | ${!index ? category.trim().slice(1) : category.trim()} |\n`;
				HTML += `
					<tr>
						<td>${CATEGORIES[index]}</td>
						<td>${!index ? category.trim().slice(1) : category.trim()}</td>
					</tr>`
			});
			text += "\n\n";
			HTML += `
				</tbody>
			</table>
		</section>`;
		}
		HTML += `
	</section>`

		const filePath = path.join(projectDir, 'compilation_summary.md');
		fs.writeFileSync(filePath, text);
		console.log("Done");
		const htmlPath = path.join(projectDir, 'compilation_summary.html');
		HTML += `
		<script>
		for (let dropdown of document.getElementsByClassName("dropdown")) {
			dropdown.style.overflow = "hidden";
			dropdown.style.height = String(dropdown.firstElementChild.offsetHeight-1) + "px";
			console.log(dropdown, dropdown.children, dropdown.firstElementChild);
			dropdown.firstElementChild.addEventListener("click", (event) => {
				let target;
				if (event.target.tagName.toLowerCase() != "section") {
					target = event.target.parentElement;
				} else { target = event.target; }
				const parent = target.parentElement;
				if (parent.style.height != "auto") {
					parent.style.height = "auto";
					target.firstElementChild.style.rotate = "0deg";
					dropdown.style.overflowX = "auto";
				} else {
					parent.style.height = String(target.offsetHeight-1) + "px";
					console.log("Closing");
					target.firstElementChild.style.rotate = "180deg";
					dropdown.style.overflowX = "hidden";
				}
			});
			dropdown.firstElementChild.firstElementChild.style.width = dropdown.firstElementChild.children[1].offsetHeight;
			dropdown.firstElementChild.firstElementChild.style.height = dropdown.firstElementChild.children[1].offsetHeight;
		}
	</script>
	<footer>
		<a href="https://www.flaticon.com/free-icons/arrowhead" title="arrowhead icons">Arrowhead icons created by IconKanan - Flaticon</a>
	</footer>
</body>
</html>`;
		fs.writeFileSync(htmlPath, HTML);
		const panel = vscode.window.createWebviewPanel(
			'htmlPreview',
			'Quartus Compilation Report',
			vscode.ViewColumn.One,
			{ enableScripts: true } // Allows <script> tags to execute
		);

		// Load from your local file
		panel.webview.html = fs.readFileSync(htmlPath.toString(), 'utf8');
		// await vscode.commands.executeCommand('workbench.action.browser.open', "file://" + htmlPath.toString());
	} catch (e) {
		console.error(e);
	}
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
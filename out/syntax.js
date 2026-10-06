import * as vscode from 'vscode';
export function activate(context) {
    // 1. Create a collection to hold your syntax errors
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('systemverilog');
    context.subscriptions.push(diagnosticCollection);
    // 2. Trigger validation when a file opens or changes
    if (vscode.window.activeTextEditor) {
        validateDocument(vscode.window.activeTextEditor.document, diagnosticCollection);
    }
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => validateDocument(doc, diagnosticCollection)));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => validateDocument(event.document, diagnosticCollection)));
}
function validateDocument(document, collection) {
    if (document.languageId !== 'systemverilog') {
        return;
    }
    const diagnostics = [];
    const text = document.getText();
    const variable = /[A-Za-z_0-9]+/;
    const direction = /input\s|output\s/;
    const assignment = /assign\s|logic\s|parameter\s|integer\s|variable\s/;
    const control = /if\s|when\s|always\s|always_ff\s|always_comb\s|else\s|begin\s|end\s/;
    const anyStart = new RegExp(`${assignment.source}|${direction.source}|${control.source}`);
    // 3. RUN YOUR PARSER HERE
    let regex = new RegExp(`\\b(${assignment.source})[^;=]*?(<)?=(\\s)*?(;|${anyStart.source}|\n)`, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        console.log(match[0]);
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        const diagnostic = new vscode.Diagnostic(range, 'Syntax Error: Expecting expression.', vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
    }
    regex = new RegExp(`(^\\b|;\\b)(?!${direction.source})((${assignment.source})[^;\n]+)(${anyStart.source}|\n)`, "gmd");
    while ((match = regex.exec(text)) !== null) {
        console.log("Assignment:", match[0]);
        const startPos = document.positionAt(match.indices[2][0]);
        const endPos = document.positionAt(match.indices[2][1]);
        const range = new vscode.Range(startPos, endPos);
        const diagnostic = new vscode.Diagnostic(range, 'Syntax Error: All statements must be terminated by a semicolon.', vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
    }
    regex = new RegExp(`\\b(?!${direction.source}|${control.source}|\\(|\\))${variable.source}\\s*(<)?=\\s*[^;)]*?\n`, "gm");
    while ((match = regex.exec(text)) !== null) {
        console.log("Generic:", match[0]);
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);
        const diagnostic = new vscode.Diagnostic(range, 'Syntax Error: All statements must be terminated by a semicolon.', vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
    }
    regex = new RegExp(`(^\\b|,\\b)((?:${direction.source})(?:${assignment.source})[^,\\n\\)]+)(?=\\n\\s*(?:${direction.source}))`, "gd");
    while ((match = regex.exec(text)) !== null) {
        console.log("Generic:", match[0]);
        const startPos = document.positionAt(match.indices[2][0]);
        const endPos = document.positionAt(match.indices[2][1]);
        const range = new vscode.Range(startPos, endPos);
        const diagnostic = new vscode.Diagnostic(range, 'Syntax Error: Expecting a comma.', vscode.DiagnosticSeverity.Error);
        diagnostics.push(diagnostic);
    }
    regex = /(\d+)'(b|o|d|h)(.+?)\b/g;
    while ((match = regex.exec(text)) !== null) {
        const bits = match[1];
        const type = match[2];
        const value = match[3];
        let error = "";
        let base = 0;
        let tempMatch;
        switch (type) {
            case 'b':
                if ((tempMatch = /[^01]/g.exec(value)) !== null) {
                    error = "Binary values can only contain 0 or 1";
                }
                base = 2;
                break;
            case 'o':
                if ((tempMatch = /[^0-7]/g.exec(value)) !== null) {
                    error = "Octal values can only contain digits 0-7";
                }
                base = 8;
                break;
            case 'd':
                if ((tempMatch = /[^0-9]/g.exec(value)) !== null) {
                    error = "Decimal values can only contain digits 0-9";
                }
                base = 10;
                break;
            case 'h':
                if ((tempMatch = /[^0-9A-Fa-f]/g.exec(value)) !== null) {
                    error = "Hexadecimal values can only contain symbols 0-F";
                }
                base = 16;
                break;
        }
        if (tempMatch) {
            const startPos = document.positionAt(tempMatch.index + match.index + bits.length + 2);
            const endPos = document.positionAt(tempMatch.index + match.index + bits.length + 2 + value.length);
            const range = new vscode.Range(startPos, endPos);
            const diagnostic = new vscode.Diagnostic(range, `Syntax Error: ${error}.`, vscode.DiagnosticSeverity.Error);
            diagnostics.push(diagnostic);
        }
        else {
            const numericVal = parseInt(value, base);
            if (numericVal > (2 ** parseInt(bits, 10) - 1)) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);
                const diagnostic = new vscode.Diagnostic(range, `Syntax Error: Size of value exceeds maximum possible value for this number of bits.`, vscode.DiagnosticSeverity.Error);
                diagnostics.push(diagnostic);
            }
        }
    }
    // 4. Update the editor with the squiggles
    collection.set(document.uri, diagnostics);
}

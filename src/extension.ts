import * as vscode from 'vscode';
import * as path from 'path';
import { translateText } from './trans-server';

import window = vscode.window;
import commands = vscode.commands;
import Range = vscode.Range;
import Position = vscode.Position;
import Selection = vscode.Selection;
import TextEditor = vscode.TextEditor;
import workspace = vscode.workspace;

const config = vscode.workspace.getConfiguration("trans-box");

export function activate(context: vscode.ExtensionContext) {

  // The command has been defined in the package.json file
  // The commandId parameter must match the command field in package.json
  const transPaste =
    commands.registerTextEditorCommand("extension.translatePaste", () => {

      const editor = window.activeTextEditor;
      if (!editor) {
        window.showInformationMessage(
          "Open a file first to manipulate text selections");
        return;
      }
      translatePaste(editor);
    });

  const rootPath = workspace.workspaceFolders?.at(0)?.uri.path;

  context.subscriptions.push(transPaste);
}

// Translate or just return text
async function getResult(currentText: string) {
  if (config.get("enableTranslate")) {
    let translated = await translateText(currentText)
      .then((result) => {
        return "\n\n" + result;
      })
      .catch((error) => {
        window.showErrorMessage(error);
        return undefined;
      });
    return translated;
  } else {
    return "\n\n" + currentText;
  }
}

// Translate current paragraph and append result bellow.
async function translatePaste(editor: TextEditor) {
  const currentRange = getRange(editor);
  const currentText = editor.document.getText(currentRange);

  const fileName = editor.document.fileName;
  const fileExt = path.extname(fileName).slice(1);

  const enclosingDelimiters: any = config.get("enclose");
  const translated = await getResult(currentText);
  // enclose with customed delimiters or just comment it
  if (translated) {
    if (fileExt in enclosingDelimiters) {
      editor.edit((e) => {
        const delimiter = enclosingDelimiters[fileExt];
        e.insert(currentRange.start, delimiter.start + "\n");
        e.insert(currentRange.end, "\n" + delimiter.end);
        // move cursor to new position
        const currentRangeWithDelimiter = getRange(editor);
        moveCursorTo(editor, currentRangeWithDelimiter.end);
        e.insert(currentRangeWithDelimiter.end, translated);
      });
    } else {
      // append duplicated text
      editor.edit((e) => {
        e.insert(currentRange.end, translated);
      });
      editor.selection = new vscode.Selection(currentRange.start, currentRange.end);
      editor.revealRange(currentRange);
      commands.executeCommand("editor.action.addCommentLine");
      commands.executeCommand("cursorMove", { to: "down", by: "line", select: false, value: 2 });
    }
  }
}

function getRange(editor: TextEditor): Range {
  // get current document and cursor position
  const doc = editor.document;
  let cursorPosition: Position = editor.selection.active;

  // get regexp for corresponding EOL
  const regexpTable = {
    [vscode.EndOfLine.LF]: /\n\n+/gm,
    [vscode.EndOfLine.CRLF]: /\r\n(\r\n)+/gm
  };
  const regexp = regexpTable[doc.eol];

  const docContent = doc.getText();
  const eofPosition = doc.positionAt(docContent.length - 1);

  // initial some holders
  let currentParagraph: Range;

  // get paragraphs and selections
  let selectedText: Selection;
  if (!editor.selection.isEmpty) {  // for selected
    selectedText = editor.selections[0];
    currentParagraph = new Range(selectedText.start, selectedText.end);
    return currentParagraph;
  } else {
    let match;
    let start = 0;

    // move down to next non-empty line
    while (doc.lineAt(cursorPosition).isEmptyOrWhitespace &&
      cursorPosition.line !== doc.lineCount - 1) {
      cursorPosition = cursorPosition.translate(1);
    }

    // find current paragraph
    while ((match = regexp.exec(docContent)) !== null) {
      const p = new Range(doc.positionAt(start), doc.positionAt(match.index));
      // cursor is in current paragraph
      if (cursorPosition.isAfterOrEqual(p.start) &&
        cursorPosition.isBeforeOrEqual(p.end)) {
        currentParagraph = p;
        return currentParagraph;
      }
      start = regexp.lastIndex;
    }

    // for last paragraph
    currentParagraph = new Range(doc.positionAt(start), eofPosition);
    return currentParagraph;
  }
}

// move cursor to specific position
function moveCursorTo(editor: TextEditor, position: Position) {
  const newSelection = new vscode.Selection(position, position);
  editor.selection = newSelection;
}

// this method is called when your extension is deactivated
// tslint:disable-next-line: no-empty
export function deactivate() { }

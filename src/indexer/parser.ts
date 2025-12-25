/**
 * TypeScript Parser
 *
 * Extracts symbols and imports from TypeScript/JavaScript files
 * using the TypeScript compiler API.
 */

import ts from 'typescript';
import type { ExtractedSymbol, ExtractedImport, ParseResult, SymbolKind } from './types.js';

/**
 * Parse a TypeScript/JavaScript file and extract symbols and imports
 */
export function parseFile(filePath: string, content: string): ParseResult {
  const symbols: ExtractedSymbol[] = [];
  const imports: ExtractedImport[] = [];
  const errors: string[] = [];

  try {
    // Determine script kind based on extension
    const scriptKind = getScriptKind(filePath);

    // Create source file
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,  // setParentNodes
      scriptKind
    );

    // Visit all nodes
    function visit(node: ts.Node, parentScope?: string) {
      try {
        // Handle different node types
        if (ts.isFunctionDeclaration(node)) {
          handleFunctionDeclaration(node, sourceFile, symbols, parentScope);
        } else if (ts.isClassDeclaration(node)) {
          handleClassDeclaration(node, sourceFile, symbols, parentScope);
          // Visit class members with class name as scope
          const className = node.name?.text;
          ts.forEachChild(node, child => visit(child, className));
          return; // Don't visit children again
        } else if (ts.isInterfaceDeclaration(node)) {
          handleInterfaceDeclaration(node, sourceFile, symbols, parentScope);
        } else if (ts.isTypeAliasDeclaration(node)) {
          handleTypeAliasDeclaration(node, sourceFile, symbols, parentScope);
        } else if (ts.isEnumDeclaration(node)) {
          handleEnumDeclaration(node, sourceFile, symbols, parentScope);
        } else if (ts.isVariableStatement(node)) {
          handleVariableStatement(node, sourceFile, symbols, parentScope);
        } else if (ts.isMethodDeclaration(node)) {
          handleMethodDeclaration(node, sourceFile, symbols, parentScope);
        } else if (ts.isPropertyDeclaration(node)) {
          handlePropertyDeclaration(node, sourceFile, symbols, parentScope);
        } else if (ts.isImportDeclaration(node)) {
          handleImportDeclaration(node, sourceFile, imports);
        } else if (ts.isExportDeclaration(node)) {
          handleExportDeclaration(node, sourceFile, symbols);
        } else if (ts.isExportAssignment(node)) {
          handleExportAssignment(node, sourceFile, symbols);
        }

        // Continue visiting children
        ts.forEachChild(node, child => visit(child, parentScope));
      } catch (err) {
        // Skip problematic nodes
      }
    }

    visit(sourceFile);
  } catch (err) {
    errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { symbols, imports, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Determine TypeScript script kind from file extension
 */
function getScriptKind(filePath: string): ts.ScriptKind {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return ts.ScriptKind.TS;
    case 'tsx':
      return ts.ScriptKind.TSX;
    case 'js':
    case 'mjs':
    case 'cjs':
      return ts.ScriptKind.JS;
    case 'jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.TS;
  }
}

/**
 * Check if a node has export modifier
 */
function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/**
 * Check if a node has default modifier
 */
function hasDefaultModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
}

/**
 * Get line and column from position
 */
function getLocation(sourceFile: ts.SourceFile, pos: number): { line: number; column: number } {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return { line: line + 1, column: character }; // 1-indexed line
}

/**
 * Get function signature
 */
function getFunctionSignature(node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction): string {
  const params = node.parameters.map(p => {
    const name = p.name.getText();
    const type = p.type ? `: ${p.type.getText()}` : '';
    const optional = p.questionToken ? '?' : '';
    return `${name}${optional}${type}`;
  }).join(', ');

  const returnType = node.type ? `: ${node.type.getText()}` : '';
  return `(${params})${returnType}`;
}

// Handler functions for different node types

function handleFunctionDeclaration(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  if (!node.name) return;

  const loc = getLocation(sourceFile, node.getStart());
  const endLoc = getLocation(sourceFile, node.getEnd());

  symbols.push({
    name: node.name.text,
    kind: 'function',
    line: loc.line,
    column: loc.column,
    endLine: endLoc.line,
    exported: hasExportModifier(node),
    isDefault: hasDefaultModifier(node),
    scope,
    signature: getFunctionSignature(node),
  });
}

function handleClassDeclaration(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  if (!node.name) return;

  const loc = getLocation(sourceFile, node.getStart());
  const endLoc = getLocation(sourceFile, node.getEnd());

  symbols.push({
    name: node.name.text,
    kind: 'class',
    line: loc.line,
    column: loc.column,
    endLine: endLoc.line,
    exported: hasExportModifier(node),
    isDefault: hasDefaultModifier(node),
    scope,
  });
}

function handleInterfaceDeclaration(
  node: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  const loc = getLocation(sourceFile, node.getStart());
  const endLoc = getLocation(sourceFile, node.getEnd());

  symbols.push({
    name: node.name.text,
    kind: 'interface',
    line: loc.line,
    column: loc.column,
    endLine: endLoc.line,
    exported: hasExportModifier(node),
    isDefault: false,
    scope,
  });
}

function handleTypeAliasDeclaration(
  node: ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  const loc = getLocation(sourceFile, node.getStart());
  const endLoc = getLocation(sourceFile, node.getEnd());

  symbols.push({
    name: node.name.text,
    kind: 'type',
    line: loc.line,
    column: loc.column,
    endLine: endLoc.line,
    exported: hasExportModifier(node),
    isDefault: false,
    scope,
    signature: node.type.getText(),
  });
}

function handleEnumDeclaration(
  node: ts.EnumDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  const loc = getLocation(sourceFile, node.getStart());
  const endLoc = getLocation(sourceFile, node.getEnd());

  symbols.push({
    name: node.name.text,
    kind: 'enum',
    line: loc.line,
    column: loc.column,
    endLine: endLoc.line,
    exported: hasExportModifier(node),
    isDefault: false,
    scope,
  });
}

function handleVariableStatement(
  node: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  const isExported = hasExportModifier(node);
  const isConst = node.declarationList.flags & ts.NodeFlags.Const;

  for (const declaration of node.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) continue;

    const loc = getLocation(sourceFile, declaration.getStart());
    const endLoc = getLocation(sourceFile, declaration.getEnd());

    // Check if it's an arrow function
    let kind: SymbolKind = isConst ? 'const' : 'variable';
    let signature: string | undefined;

    if (declaration.initializer) {
      if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
        kind = 'function';
        signature = getFunctionSignature(declaration.initializer as ts.ArrowFunction);
      }
    }

    symbols.push({
      name: declaration.name.text,
      kind,
      line: loc.line,
      column: loc.column,
      endLine: endLoc.line,
      exported: isExported,
      isDefault: false,
      scope,
      signature,
    });
  }
}

function handleMethodDeclaration(
  node: ts.MethodDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  if (!ts.isIdentifier(node.name)) return;

  const loc = getLocation(sourceFile, node.getStart());
  const endLoc = getLocation(sourceFile, node.getEnd());

  symbols.push({
    name: node.name.text,
    kind: 'method',
    line: loc.line,
    column: loc.column,
    endLine: endLoc.line,
    exported: false, // Methods are exported via their class
    isDefault: false,
    scope,
    signature: getFunctionSignature(node),
  });
}

function handlePropertyDeclaration(
  node: ts.PropertyDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[],
  scope?: string
) {
  if (!ts.isIdentifier(node.name)) return;

  const loc = getLocation(sourceFile, node.getStart());

  symbols.push({
    name: node.name.text,
    kind: 'property',
    line: loc.line,
    column: loc.column,
    exported: false,
    isDefault: false,
    scope,
    signature: node.type?.getText(),
  });
}

function handleImportDeclaration(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  imports: ExtractedImport[]
) {
  const moduleSpecifier = node.moduleSpecifier;
  if (!ts.isStringLiteral(moduleSpecifier)) return;

  const sourcePath = moduleSpecifier.text;
  const loc = getLocation(sourceFile, node.getStart());
  const isTypeOnly = node.importClause?.isTypeOnly ?? false;

  const importClause = node.importClause;
  if (!importClause) {
    // Side-effect import: import 'foo'
    imports.push({
      importedName: '*',
      sourcePath,
      isDefault: false,
      isNamespace: false,
      isType: false,
      line: loc.line,
    });
    return;
  }

  // Default import: import Foo from 'foo'
  if (importClause.name) {
    imports.push({
      importedName: importClause.name.text,
      sourcePath,
      isDefault: true,
      isNamespace: false,
      isType: isTypeOnly,
      line: loc.line,
    });
  }

  const namedBindings = importClause.namedBindings;
  if (namedBindings) {
    if (ts.isNamespaceImport(namedBindings)) {
      // Namespace import: import * as Foo from 'foo'
      imports.push({
        importedName: namedBindings.name.text,
        sourcePath,
        isDefault: false,
        isNamespace: true,
        isType: isTypeOnly,
        line: loc.line,
      });
    } else if (ts.isNamedImports(namedBindings)) {
      // Named imports: import { Foo, Bar as Baz } from 'foo'
      for (const element of namedBindings.elements) {
        const isTypeImport = isTypeOnly || element.isTypeOnly;
        imports.push({
          importedName: element.propertyName?.text ?? element.name.text,
          localName: element.propertyName ? element.name.text : undefined,
          sourcePath,
          isDefault: false,
          isNamespace: false,
          isType: isTypeImport,
          line: loc.line,
        });
      }
    }
  }
}

function handleExportDeclaration(
  node: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[]
) {
  // Re-exports: export { Foo } from './bar'
  // We don't track these as new symbols, they reference existing ones
}

function handleExportAssignment(
  node: ts.ExportAssignment,
  sourceFile: ts.SourceFile,
  symbols: ExtractedSymbol[]
) {
  // export default expression
  // We already handle this via modifiers on other declarations
}

/**
 * Parse file content and return only symbols (convenience function)
 */
export function extractSymbols(filePath: string, content: string): ExtractedSymbol[] {
  return parseFile(filePath, content).symbols;
}

/**
 * Parse file content and return only imports (convenience function)
 */
export function extractImports(filePath: string, content: string): ExtractedImport[] {
  return parseFile(filePath, content).imports;
}

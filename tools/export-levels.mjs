import { readFile, writeFile } from "node:fs/promises";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error("Usage: node export-levels.mjs <src\\b.java> <docs\\levels.json>");
}

const source = await readFile(sourcePath, "utf8");

function readTable(name) {
  const declaration = new RegExp(`this\\.${name}\\s*=\\s*new\\s+short\\s*\\[\\]\\s*\\[\\]\\s*\\{`);
  const match = declaration.exec(source);
  if (!match) throw new Error(`Could not find source table ${name}`);

  const open = source.indexOf("{", match.index);
  let depth = 0;
  let end = -1;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error(`Unclosed source table ${name}`);

  const body = source.slice(open + 1, end);
  const rows = [];
  let rowStart = 0;
  depth = 0;
  for (let index = 0; index <= body.length; index += 1) {
    const character = body[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (character === "," && depth === 0 || index === body.length) {
      const row = body.slice(rowStart, index).trim();
      if (row.startsWith("{")) {
        rows.push([...row.matchAll(/-?\d+/g)].map((value) => Number(value[0])));
      } else if (/^new\s+short\s*\[\s*0\s*\]$/.test(row)) {
        rows.push([]);
      } else {
        throw new Error(`Unexpected row in ${name}: ${row}`);
      }
      rowStart = index + 1;
    }
  }
  return rows;
}

const platformNames = ["aZ", "ba", "bb", "bc", "bd", "be", "bf", "bg", "bh", "bi"];
const objectNames = ["bj", "bk", "bl", "bm", "bn", "bo", "bp", "bq", "br", "bs"];
const stages = platformNames.map((name, stage) => {
  const platforms = readTable(name);
  const objects = readTable(objectNames[stage]);
  if (platforms.length !== 16 || platforms.some((row) => row.length !== 6)) {
    throw new Error(`Unexpected platform data shape in ${name}`);
  }
  if (objects.length !== 16 || objects.some((row) => row.length % 3 !== 0)) {
    throw new Error(`Unexpected object data shape in ${objectNames[stage]}`);
  }
  return { platforms, objects };
});

await writeFile(outputPath, `${JSON.stringify({ stages })}\n`, "utf8");

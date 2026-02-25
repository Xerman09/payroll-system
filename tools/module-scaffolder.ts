import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const featureName = args[0];

if (!featureName) {
  console.error('Usage: npx ts-node tools/module-scaffolder.ts <feature-name>');
  process.exit(1);
}

// PascalCase helper
const toPascalCase = (str: string) =>
  str.replace(/(^\w|-\w)/g, (g) => g.replace(/-/, "").toUpperCase());

const pascalFeature = toPascalCase(featureName);

// Paths
const moduleDir = path.join(process.cwd(), 'modules', featureName);
const appDir = path.join(process.cwd(), 'app', 'dashboard', featureName);

// Arrays of things to create
const dirsToCreate = [
  moduleDir,
  path.join(moduleDir, 'components'),
  path.join(moduleDir, 'providers'),
  appDir
];

// Check existence
if (fs.existsSync(moduleDir) || fs.existsSync(appDir)) {
  console.error(`Error: Module or Dashboard path already exists for ${featureName}`);
  process.exit(1);
}

// 1. Create Directories
dirsToCreate.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// 2. Create types.ts
const typesContent = `export interface ${pascalFeature} {
  id: string;
  created_at: string;
  // Add domain fields here
}
`;
fs.writeFileSync(path.join(moduleDir, 'types.ts'), typesContent);

// 3. Create Provider (Api Service)
const providerContent = `import { ${pascalFeature} } from "../types";

const BASE_API = "/api/${featureName}";

export async function fetch${pascalFeature}List() {
  // Placeholder for data fetching logic
  return [];
}
`;
fs.writeFileSync(path.join(moduleDir, 'providers', `${featureName}Api.ts`), providerContent);

// 4. Create Main Module Component
const moduleComponentContent = `import React from 'react';
// import { use${pascalFeature} } from './providers/${featureName}Api';

export default function ${pascalFeature}Module() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-3xl font-bold tracking-tight">${pascalFeature}</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Components go here */}
        <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
           Placeholder Content
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync(path.join(moduleDir, `${pascalFeature}Module.tsx`), moduleComponentContent);

// 5. Create Page (Server Component Shell)
const pageContent = `import { Metadata } from "next";
import ${pascalFeature}Module from "@/modules/${featureName}/${pascalFeature}Module";

export const metadata: Metadata = {
  title: "${pascalFeature} | Payroll System",
};

export default function ${pascalFeature}Page() {
  return <${pascalFeature}Module />;
}
`;
fs.writeFileSync(path.join(appDir, 'page.tsx'), pageContent);

console.log(`✅ Module scaffolded successfully!`);
console.log(`   - Modules: modules/${featureName}`);
console.log(`   - Dashboard: app/dashboard/${featureName}`);

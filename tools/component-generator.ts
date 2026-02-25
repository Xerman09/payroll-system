import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const componentName = args[0];
const modulePath = args[1]; // e.g., "modules/wage"

if (!componentName || !modulePath) {
  console.error('Usage: npx ts-node tools/component-generator.ts <ComponentName> <module/path>');
  process.exit(1);
}

const targetDir = path.join(process.cwd(), modulePath, 'components');
const targetFile = path.join(targetDir, `${componentName}.tsx`);

if (fs.existsSync(targetFile)) {
  console.error(`Error: Component already exists at ${targetFile}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const content = `import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface ${componentName}Props {
  title?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

export function ${componentName}({ title, icon: Icon, children }: ${componentName}Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <Card className="bg-background/60 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden">
        <CardHeader className="border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-primary" />}
            <CardTitle className="text-lg font-semibold tracking-tight">
              {title || '${componentName}'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {children || (
            <div className="text-muted-foreground text-sm">
              ${componentName} content goes here...
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
`;

fs.writeFileSync(targetFile, content);
console.log(`✅ Component scaffolded: ${targetFile}`);

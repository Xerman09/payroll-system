import * as fs from 'fs';
import * as path from 'path';

// Get feature name from command line arguments
const args = process.argv.slice(2);
const featureName = args[0];

if (!featureName) {
  console.error('Usage: npx ts-node tools/api-scaffolder.ts <feature-name>');
  process.exit(1);
}

// Define target directory and file
const targetDir = path.join(process.cwd(), 'app', 'api', featureName);
const targetFile = path.join(targetDir, 'route.ts');

// Check if route already exists
if (fs.existsSync(targetFile)) {
  console.error(`Error: API route already exists at ${targetFile}`);
  process.exit(1);
}

// Create directory if it doesn't exist
fs.mkdirSync(targetDir, { recursive: true });

// Define the template content
const content = `import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Define allowed resources for security
const ALLOWED_RESOURCES = {
  // Add your Directus collection names here
  // 'example_collection': true,
};

// Input validation schema
const postSchema = z.object({
  // Define your input schema here
  // id: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource");
  const path = searchParams.get("path");

  // Basic Security Check
  if (resource && !ALLOWED_RESOURCES[resource as keyof typeof ALLOWED_RESOURCES]) {
     return NextResponse.json({ error: "Forbidden Resource" }, { status: 403 });
  }

  // Construct Directus URL logic would go here
  // This is a scaffold, so we return a placeholder response
  
  return NextResponse.json({ 
    message: "Scaffolded API Route for ${featureName}",
    resource,
    path
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const data = postSchema.parse(body);
    
    return NextResponse.json({ message: "Created", data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
  }
}
`;

// Write the file
fs.writeFileSync(targetFile, content);
console.log(`✅ API Route scaffolded: ${targetFile}`);

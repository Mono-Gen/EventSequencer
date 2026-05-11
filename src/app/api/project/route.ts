import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Get absolute path more reliably
const DATA_DIR = path.resolve(process.cwd(), 'data');

function validateProjectName(name: string): boolean {
  // 英数字・ハイフン・アンダースコア・スペースのみ許可 (1-64文字)
  return /^[\w\- ]{1,64}$/.test(name);
}

async function ensureDir() {
  try {
    await fs.access(DATA_DIR);
    console.log(`[API] Data directory confirmed at: ${DATA_DIR}`);
  } catch {
    console.log(`[API] Creating data directory at: ${DATA_DIR}`);
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

export async function GET(req: Request) {
  try {
    await ensureDir();
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');

    if (name) {
      if (!validateProjectName(name)) {
        return NextResponse.json({ success: false, error: 'Invalid project name' }, { status: 400 });
      }
      const filePath = path.join(DATA_DIR, `${name}.json`);
      
      // path.resolve で DATA_DIR 外への脱出を二重チェック
      if (!path.resolve(filePath).startsWith(path.resolve(DATA_DIR))) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      console.log(`[API] Loading project: ${filePath}`);
      const data = await fs.readFile(filePath, 'utf-8');
      return NextResponse.json({ success: true, data: JSON.parse(data) });
    } else {
      const files = await fs.readdir(DATA_DIR);
      const projects = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      console.log(`[API] Listing projects: ${projects.join(', ')}`);
      return NextResponse.json({ success: true, projects });
    }
  } catch (error) {
    console.error(`[API] GET Error:`, error);
    return NextResponse.json({ success: false, error: 'Failed to access projects' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDir();
    const { name, data } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    
    if (!validateProjectName(name)) {
      return NextResponse.json({ success: false, error: 'Invalid project name' }, { status: 400 });
    }

    const filePath = path.join(DATA_DIR, `${name}.json`);
    
    // path.resolve で DATA_DIR 外への脱出を二重チェック
    if (!path.resolve(filePath).startsWith(path.resolve(DATA_DIR))) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    console.log(`[API] Saving project to: ${filePath}`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[API] Successfully saved: ${name}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API] POST Error:`, error);
    return NextResponse.json({ success: false, error: 'Failed to save project' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    if (!name) return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });

    if (!validateProjectName(name)) {
      return NextResponse.json({ success: false, error: 'Invalid project name' }, { status: 400 });
    }

    const filePath = path.join(DATA_DIR, `${name}.json`);
    
    // path.resolve で DATA_DIR 外への脱出を二重チェック
    if (!path.resolve(filePath).startsWith(path.resolve(DATA_DIR))) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    console.log(`[API] Deleting project: ${filePath}`);
    await fs.unlink(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API] DELETE Error:`, error);
    return NextResponse.json({ success: false, error: 'Failed to delete project' }, { status: 500 });
  }
}

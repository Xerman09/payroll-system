/**
 * Configuration for the 7 active companies in the system.
 * These are mapped to environment variables in .env.local
 */

export interface CompanyConfig {
  id: string;
  name: string;
  apiBase: string;
  deptId: string;
  description: string;
  color: string;
}

export const COMPANIES: CompanyConfig[] = [
  {
    id: "men2",
    name: process.env.API_BASE_NAME_I || "Men2 Marketing Corporation",
    apiBase: process.env.API_BASE_I || "http://goatedcodoer:8091",
    deptId: process.env.API_DEPT_ID_I || "2",
    description: "Marketing and Distribution Services",
    color: "#6366f1" // indigo-500
  },
  {
    id: "hanvin",
    name: process.env.API_BASE_NAME_II || "Hanvin Construction",
    apiBase: process.env.API_BASE_II || "http://goatedcodoer:8092",
    deptId: process.env.API_DEPT_ID_II || "2",
    description: "Infrastructure & Civil Engineering",
    color: "#8b5cf6" // violet-500
  },
  {
    id: "vertex",
    name: process.env.API_BASE_NAME_III || "Vertex Technology Corporation",
    apiBase: process.env.API_BASE_III || "http://goatedcodoer:8090",
    deptId: process.env.API_DEPT_ID_III || "6",
    description: "Enterprise Technology Solutions",
    color: "#3b82f6" // blue-500
  },
  {
    id: "rc2",
    name: process.env.API_BASE_NAME_IV || "RC2 Technologies Corporation",
    apiBase: process.env.API_BASE_IV || "http://163.245.192.226:8071",
    deptId: process.env.API_DEPT_ID_IV || "2",
    description: "Advanced Computing & Networking",
    color: "#ec4899" // pink-500
  },
  {
    id: "vital",
    name: process.env.API_BASE_NAME_V || "Vital",
    apiBase: process.env.API_BASE_V || "http://163.245.192.226:8072",
    deptId: process.env.API_DEPT_ID_V || "2",
    description: "Healthcare & Wellness Systems",
    color: "#10b981" // emerald-500
  },
  {
    id: "cafeteria",
    name: process.env.API_BASE_NAME_VI || "Cafeteria",
    apiBase: process.env.API_BASE_VI || "http://163.245.192.226:8073",
    deptId: process.env.API_DEPT_ID_VI || "2",
    description: "VTC Hospitality & Food Services",
    color: "#f59e0b" // amber-500
  },
  {
    id: "manufacturing",
    name: process.env.API_BASE_NAME_VII || "Manufacturing",
    apiBase: process.env.API_BASE_VII || "http://163.245.192.226:8074",
    deptId: process.env.API_DEPT_ID_VII || "2",
    description: "Industrial Production & Logistics",
    color: "#ef4444" // red-500
  },
  {
    id: "rsm",
    name: process.env.API_BASE_NAME_VIII || "RSM Holdings",
    apiBase: process.env.API_BASE_VIII || "http://192.168.0.253:8093",
    deptId: process.env.API_DEPT_ID_VIII || "2",
    description: "Strategic Investment & Management",
    color: "#06b6d4" // cyan-500
  },
  {
    id: "hr_solutions",
    name: process.env.API_BASE_NAME_IX || "HR Solutions",
    apiBase: process.env.API_BASE_IX || "http://192.168.0.253:8094",
    deptId: process.env.API_DEPT_ID_IX || "2",
    description: "HR Strategic Partners",
    color: "#f97316" // orange-500
  }
];

export function getCompanyById(id: string | null | undefined): CompanyConfig | null {
  if (!id) return null;
  return COMPANIES.find(c => c.id === id) || null;
}

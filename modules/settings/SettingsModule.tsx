"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useColorTheme, ThemeColor } from "@/providers/ColorThemeProvider";
import { useSidebar } from "@/providers/SidebarProvider";
import { HueWheel } from "./components/HueWheel";
import { 
  Keyboard, 
  Palette, 
  Navigation, 
  RotateCcw, 
  Command, 
  MousePointer2,
  Trash2,
  Moon,
  Sun,
  Check,
  Paintbrush,
  Sparkles
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Shortcut {
  id: string;
  name: string;
  keys: string;
  category: "General" | "Navigation" | "Processing";
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "search", name: "Global Search", keys: "Ctrl + K", category: "General" },
  { id: "sidebar", name: "Toggle Sidebar", keys: "Alt + B", category: "General" },
  { id: "dashboard", name: "Go to Dashboard", keys: "Alt + D", category: "Navigation" },
  { id: "profile", name: "Go to My Profile", keys: "Alt + S", category: "Navigation" },
  { id: "payroll", name: "Payroll Records", keys: "Alt + R", category: "Navigation" },
  { id: "wage", name: "Wage Management", keys: "Alt + W", category: "Navigation" },
  { id: "close", name: "Close Modals/Search", keys: "Esc", category: "General" },
];

export function SettingsModule() {
  const { theme, setTheme } = useTheme();
  const { 
    activeColor, 
    setActiveColor, 
    customHue, 
    setCustomHue, 
    customHex,
    setCustomHex,
    savedThemes, 
    addSavedTheme,
    removeSavedTheme,
    themes 
  } = useColorTheme();
  
  const { autoCollapse, setAutoCollapse } = useSidebar();
  
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam && ["general", "shortcuts", "navigation"].includes(tabParam)) {
      return tabParam;
    }
    return "general";
  });
  
  const [compactMode, setCompactMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("setting_compact_mode") === "true";
    }
    return false;
  });

  const [newThemeName, setNewThemeName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync with URL tab param
  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam && ["general", "shortcuts", "navigation"].includes(tabParam)) {
      if (tabParam !== activeTab) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(tabParam);
      }
    }
  }, [searchParams, activeTab]);

  const handleSaveTheme = () => {
    if (!newThemeName.trim()) return;
    addSavedTheme(newThemeName.trim(), customHue, customHex);
    setNewThemeName("");
    setIsSaving(false);
  };

  const toggleCompactMode = (val: boolean) => {
    setCompactMode(val);
    localStorage.setItem("setting_compact_mode", String(val));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">System Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your interface preferences and keyboard shortcuts.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-12 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl">
          <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            <Palette className="h-4 w-4 mr-2" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            <Keyboard className="h-4 w-4 mr-2" /> Shortcuts
          </TabsTrigger>
          <TabsTrigger value="navigation" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            <Navigation className="h-4 w-4 mr-2" /> Navigation
          </TabsTrigger>
        </TabsList>

        {/* Appearance Tab */}
        <TabsContent value="general" className="outline-none space-y-6">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Paintbrush className="h-5 w-5 text-primary" />
                Theme Color
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setActiveColor("blue")}
                className="h-8 gap-2 text-primary border-primary/20 hover:bg-primary/5 hover:text-primary shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to Default
              </Button>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                {/* 1. System Preset Themes */}
                {(Object.keys(themes) as Exclude<ThemeColor, "custom">[]).map((colorKey) => {
                  const themeConfig = themes[colorKey];
                  const isActive = activeColor === colorKey;
                  const primaryColor = `oklch(${themeConfig.lightness} ${themeConfig.chroma} ${themeConfig.hue})`;
                  
                  return (
                    <button
                      key={colorKey}
                      onClick={() => setActiveColor(colorKey)}
                      className={cn(
                        "group relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300",
                        isActive 
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md" 
                          : "border-gray-200 dark:border-gray-800 bg-transparent hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm"
                      )}
                    >
                      <div 
                        className="h-10 w-10 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {isActive && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest truncate w-full text-center px-1",
                        isActive ? "text-primary" : "text-gray-500"
                      )}>
                        {themeConfig.name}
                      </span>
                    </button>
                  );
                })}

                {/* 2. User Saved Themes */}
                {savedThemes.map((savedTheme) => {
                  const isActive = activeColor === savedTheme.id;
                  const primaryColor = savedTheme.hex || `oklch(0.6 0.2 ${savedTheme.hue})`;
                  
                  return (
                    <div
                      key={savedTheme.id}
                      className={cn(
                        "group relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300 animate-in fade-in zoom-in duration-300 overflow-hidden",
                        isActive 
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md" 
                          : "border-gray-200 dark:border-gray-800 bg-transparent hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm"
                      )}
                    >
                      <div 
                        className="h-10 w-10 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {isActive && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest truncate w-full text-center px-1 transition-opacity duration-300",
                        isActive ? "text-primary" : "text-gray-500",
                        "group-hover:opacity-0"
                      )}>
                        {savedTheme.name}
                      </span>

                      {/* Hover Overlay Buttons */}
                      <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity duration-300 p-2 z-10">
                        <Button 
                          size="sm" 
                          variant="default"
                          className="w-full h-7 text-[10px] font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                          onClick={() => setActiveColor(savedTheme.id)}
                        >
                          Use
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSavedTheme(savedTheme.id);
                          }}
                          className="w-full h-7 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 hover:bg-red-500 hover:text-white text-red-600 dark:text-red-400 border-none shadow-none"
                        >
                          <Trash2 size={12} className="mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* 3. Spectrum/Plus Toggle */}
                <button
                  onClick={() => setActiveColor("custom")}
                  className={cn(
                    "group relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300 overflow-hidden",
                    activeColor === "custom" 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md" 
                      : "border-gray-200 dark:border-gray-800 bg-transparent hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-sm"
                  )}
                >
                  <div 
                    className={cn(
                      "h-10 w-10 rounded-full shadow-inner flex items-center justify-center transition-transform group-hover:scale-110",
                      activeColor === "custom" ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                    )}
                    style={{ background: "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
                  >
                    {activeColor === "custom" ? <Sparkles className="h-5 w-5 text-white" strokeWidth={2} /> : <div className="text-white text-xl font-bold">+</div>}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    activeColor === "custom" ? "text-primary" : "text-gray-500"
                  )}>
                    {activeColor === "custom" ? "Spectrum" : "Add Custom"}
                  </span>
                </button>
              </div>

              {activeColor === "custom" && (
                <div className="flex flex-col items-center space-y-6 py-8 bg-gray-50/50 dark:bg-gray-800/20 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="text-center space-y-1">
                        <Label className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-[0.2em]">Theme Creation Studio</Label>
                        <p className="text-xs text-muted-foreground">Fine-tune your brand color and save it to your library.</p>
                    </div>
                    
                    <HueWheel 
                        hue={customHue} 
                        onChange={setCustomHue} 
                        hex={customHex}
                        onHexChange={setCustomHex}
                    />

                    <div className="flex flex-col items-center gap-4 w-full max-w-sm px-6">
                        {!isSaving ? (
                            <Button 
                                onClick={() => setIsSaving(true)}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold tracking-wider rounded-xl py-6"
                            >
                                <Sparkles className="h-4 w-4 mr-2" /> Save this Theme
                            </Button>
                        ) : (
                            <div className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1">Theme Name</Label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. LUXURY NEON"
                                        value={newThemeName}
                                        onChange={(e) => setNewThemeName(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold tracking-widest uppercase"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline"
                                        onClick={() => setIsSaving(false)}
                                        className="flex-1 rounded-xl py-6"
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        disabled={!newThemeName.trim()}
                                        onClick={handleSaveTheme}
                                        className="flex-[2] bg-primary hover:bg-primary/90 text-white font-bold tracking-wider rounded-xl py-6"
                                    >
                                        Add to Library
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
              )}

              <Separator />

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-semibold">Dark Mode</Label>
                      {theme === "dark" ? <Moon className="h-4 w-4 text-primary/70" /> : <Sun className="h-4 w-4 text-orange-400" />}
                    </div>
                    <p className="text-sm text-muted-foreground">Switch between light and dark themes.</p>
                  </div>
                  <Switch 
                    checked={theme === "dark"} 
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Reduce whitespace in tables and lists for higher data density.</p>
                  </div>
                  <Switch checked={compactMode} onCheckedChange={toggleCompactMode} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shortcuts Tab */}
        <TabsContent value="shortcuts" className="outline-none space-y-6">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Keyboard Shortcuts</CardTitle>
                <CardDescription>System-wide hotkeys for rapid navigation.</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" /> Reset Defaults
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Command</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{ width: "150px" }}>Default Key</th>
                      <th className="px-4 py-3 text-right font-semibold" style={{ width: "100px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {DEFAULT_SHORTCUTS.map((shortcut) => (
                      <tr key={shortcut.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{shortcut.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{shortcut.category}</div>
                        </td>
                        <td className="px-4 py-3">
                          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-xs">
                            {shortcut.keys}
                          </kbd>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <MousePointer2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 dark:border-primary/20 flex gap-3 text-primary">
                <Command className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">
                  <strong>Tip:</strong> You can hit <kbd className="font-bold">Ctrl + K</kbd> from anywhere to open the search bar and run these commands by name.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Navigation Tab */}
        <TabsContent value="navigation" className="outline-none space-y-6">
          <Card className="border-none shadow-sm bg-white dark:bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-lg">Sidebar Behavior</CardTitle>
              <CardDescription>Configure how the main navigation sidebar interacts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Auto-collapse Sidebar</Label>
                  <p className="text-sm text-muted-foreground">Automatically collapse the sidebar on page change.</p>
                </div>
                <Switch checked={autoCollapse} onCheckedChange={setAutoCollapse} />
              </div>

              <Separator />

              <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold italic">Show Recent Modules</Label>
                  <p className="text-sm text-muted-foreground">Keep a list of your most visited pages in the sidebar.</p>
                </div>
                <Switch checked={false} disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

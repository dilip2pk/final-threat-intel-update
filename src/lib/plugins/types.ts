/**
 * Plugin System — Type Definitions
 * 
 * This defines the contract that all plugins (internal or external) must follow.
 * Developers building features in separate Lovable projects should export
 * modules conforming to these interfaces.
 */

import type { ComponentType } from "react";

/** Metadata every plugin must declare */
export interface PluginMetadata {
  id: string;                    // Unique plugin identifier (kebab-case)
  name: string;                  // Display name
  version: string;               // Semver version string
  description: string;           // Short description
  author?: string;               // Author name
  icon?: string;                 // Lucide icon name or emoji
  category: PluginCategory;      // Functional category
  requires?: string[];           // IDs of plugins this depends on
  minAppVersion?: string;        // Minimum app version required
}

export type PluginCategory =
  | "hunting"
  | "recon"
  | "network"
  | "vuln"
  | "forensics"
  | "reporting"
  | "integration"
  | "misc";

/** A route contributed by a plugin */
export interface PluginRoute {
  path: string;                  // Route path (e.g., "/threat-hunt")
  component: ComponentType;      // React component to render
  label: string;                 // Sidebar / nav label
  icon?: string;                 // Lucide icon name
  adminOnly?: boolean;           // Require admin role
}

/** A widget that can be embedded in dashboards */
export interface PluginWidget {
  id: string;
  component: ComponentType<any>;
  defaultSize?: "sm" | "md" | "lg" | "full";
  slots?: string[];              // Where widget can appear (e.g., "dashboard", "threat-hunt")
}

/** Full plugin definition */
export interface PluginDefinition {
  metadata: PluginMetadata;
  routes?: PluginRoute[];
  widgets?: PluginWidget[];
  onActivate?: () => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}

/** Plugin validation result */
export interface PluginValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

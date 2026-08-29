export interface TaskIntent {
  rawPrompt: string;
  taskType: 'code' | 'research' | 'analysis';
  capability: string;                  // e.g. 'python' | 'rust' | 'research' | 'data' | 'ml'
  specialization?: string;              // e.g. 'debugging' | 'security' | 'data-analysis'
  title: string;
  description: string;
  budget: number;                       // in INR
  deadlineSeconds: number;              // in seconds
  qualityThreshold: number;             // e.g. 80
}

export class CommandInterpreter {
  /**
   * Deterministic Natural Language Command Parser
   * Extracts task intent fields without financial mutation authority.
   */
  static parse(prompt: string): TaskIntent {
    const trimmed = prompt.trim();
    const lower = trimmed.toLowerCase();

    // 1. Budget extraction (e.g. ₹150 or 150 INR or budget 150 or rs 150)
    let budget = 150; // Default budget
    const inrMatch = lower.match(/(?:₹|inr|\$|\bfor\b\s+)(\d+(?:\.\d+)?)/i) || lower.match(/(\d+)\s*(?:rupees|inr|rs)/i);
    if (inrMatch && inrMatch[1]) {
      const parsed = parseFloat(inrMatch[1]);
      if (!isNaN(parsed) && parsed > 0) {
        budget = parsed;
      }
    }

    // 2. Deadline extraction (e.g. 15 minutes, 20 mins, 1 hour)
    let deadlineSeconds = 900; // Default 15 minutes (900s)
    const minMatch = lower.match(/(\d+)\s*(?:min|mins|minute|minutes)/i);
    const hourMatch = lower.match(/(\d+)\s*(?:hr|hrs|hour|hours)/i);
    if (minMatch && minMatch[1]) {
      const mins = parseInt(minMatch[1], 10);
      if (!isNaN(mins) && mins > 0) deadlineSeconds = mins * 60;
    } else if (hourMatch && hourMatch[1]) {
      const hrs = parseInt(hourMatch[1], 10);
      if (!isNaN(hrs) && hrs > 0) deadlineSeconds = hrs * 3600;
    }

    // 3. Task Type & Capability extraction matching 75 Agent Profiles
    let taskType: TaskIntent['taskType'] = 'code';
    let capability = 'python';
    let specialization = 'debugging';

    if (lower.includes('research') || lower.includes('summar') || lower.includes('market') || lower.includes('report')) {
      taskType = 'research';
      capability = 'research';
      specialization = 'summary';
    } else if (lower.includes('analys') || lower.includes('data') || lower.includes('sql') || lower.includes('stat')) {
      taskType = 'analysis';
      capability = lower.includes('sql') ? 'sql' : 'data';
      specialization = 'data-analysis';
    } else if (lower.includes('ml') || lower.includes('machine learning') || lower.includes('model')) {
      taskType = 'analysis';
      capability = 'ml';
      specialization = 'data-analysis';
    } else if (lower.includes('rust') || lower.includes('solidity') || lower.includes('contract') || lower.includes('smart')) {
      taskType = 'code';
      capability = lower.includes('rust') ? 'rust' : 'security';
      specialization = 'security';
    } else {
      taskType = 'code';
      capability = 'python';
      if (lower.includes('optimiz')) specialization = 'optimization';
      else if (lower.includes('secur') || lower.includes('audit')) specialization = 'security';
      else if (lower.includes('test')) specialization = 'testing';
      else specialization = 'debugging';
    }

    // 4. Quality Threshold
    let qualityThreshold = 80;
    if (taskType === 'code') qualityThreshold = 90;

    const title = `${capability.toUpperCase()} ${specialization.charAt(0).toUpperCase() + specialization.slice(1)} Task`;
    const description = `Autonomous ${taskType} task: ${trimmed}`;

    return {
      rawPrompt: trimmed,
      taskType,
      capability,
      specialization,
      title,
      description,
      budget,
      deadlineSeconds,
      qualityThreshold
    };
  }
}

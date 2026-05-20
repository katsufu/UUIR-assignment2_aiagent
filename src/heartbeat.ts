import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface HealthStatus {
  status: 'healthy' | 'degraded';
  timestamp: string;
  checks: {
    apiConfiguration: 'configured' | 'missing';
    dictionaryAccess: 'available' | 'unavailable';
    skillsLoaded: 'available' | 'unavailable';
  };
}

/**
 * Executes a lightweight, zero-cost, zero-leak system health check.
 * Strictly prevents leaking any credentials or keys.
 */
export function checkSystemHealth(): HealthStatus {
  const isApiKeyConfigured = !!process.env.BERGET_API_KEY && process.env.BERGET_API_KEY.trim().length > 0;

  // Verify dictionary tools/reference libraries are accessible
  let isDictionaryAccessible = false;
  try {
    const skillsDir = path.resolve(__dirname, '../.skills');
    if (fs.existsSync(skillsDir)) {
      isDictionaryAccessible = true;
    }
  } catch (e) {
    isDictionaryAccessible = false;
  }

  // Verify skills directories are loaded
  let isSkillsLoaded = false;
  try {
    const requiredSkills = ['stylistic_shift', 'rhyme_and_rhythm', 'custom_task'];
    const skillsDir = path.resolve(__dirname, '../.skills');
    isSkillsLoaded = requiredSkills.every(skill => fs.existsSync(path.join(skillsDir, skill)));
  } catch (e) {
    isSkillsLoaded = false;
  }

  const isHealthy = isApiKeyConfigured && isDictionaryAccessible && isSkillsLoaded;

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      apiConfiguration: isApiKeyConfigured ? 'configured' : 'missing',
      dictionaryAccess: isDictionaryAccessible ? 'available' : 'unavailable',
      skillsLoaded: isSkillsLoaded ? 'available' : 'unavailable',
    }
  };
}

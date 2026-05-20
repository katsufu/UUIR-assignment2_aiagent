import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type SkillName = 'stylistic_shift' | 'rhyme_and_rhythm' | 'custom_task';

export interface Skill {
  name: SkillName;
  systemInstructions: string;
}

/**
 * Load instructions for a specific specialized skill.
 */
export function getSkill(name: SkillName): Skill {
  const skillsDir = path.resolve(__dirname, '../.skills');
  const filePath = path.join(skillsDir, name, 'instructions.md');

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      name,
      systemInstructions: content,
    };
  } catch (error) {
    throw new Error(`Failed to load instructions for skill '${name}' at path '${filePath}': ${error}`);
  }
}

/**
 * Return all available specialized C2 skills.
 */
export function getAllSkills(): Skill[] {
  return [
    getSkill('stylistic_shift'),
    getSkill('rhyme_and_rhythm'),
    getSkill('custom_task'),
  ];
}

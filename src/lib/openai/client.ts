import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateBioInput {
  username: string;
  repos: Array<{
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
  }>;
  totalContributions: number;
  topLanguages: string[];
}

export async function generateProfileBio(input: GenerateBioInput): Promise<string> {
  const { username, repos, totalContributions, topLanguages } = input;

  const topRepos = repos
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 5)
    .map((r) => `- ${r.name} (${r.stars} stars): ${r.description || 'No description'}`)
    .join('\n');

  const prompt = `Create a compelling 2-3 sentence developer bio for ${username}.

GitHub Stats:
- Total yearly contributions: ${totalContributions}
- Top programming languages: ${topLanguages.join(', ')}
- Total repositories: ${repos.length}

Top Projects:
${topRepos}

Write a professional but friendly bio that highlights their expertise and notable work. Make it authentic and engaging, suitable for a developer showcase page similar to BuyMeACoffee. Do not use emojis.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional tech writer who creates compelling developer bios. Write concise, authentic bios that highlight technical expertise.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI bio generation error:', error);
    throw new Error('Failed to generate bio');
  }
}

export async function generateTagline(username: string, topLanguages: string[]): Promise<string> {
  const prompt = `Create a short, catchy tagline (5-8 words) for developer ${username} who specializes in ${topLanguages.slice(0, 3).join(', ')}.

Examples:
- "Building scalable web apps with React"
- "Full-stack developer passionate about open source"
- "AI/ML engineer creating intelligent solutions"

Make it professional yet personable. No emojis.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
      temperature: 0.8,
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI tagline generation error:', error);
    throw new Error('Failed to generate tagline');
  }
}

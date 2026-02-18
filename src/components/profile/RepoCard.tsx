'use client';

import { Card } from '../ui/Card';

interface RepoCardProps {
  repo: {
    name: string;
    description: string | null;
    url: string;
    stars: number;
    forks: number;
    language: string | null;
  };
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <Card padding="md" className="hover:shadow-md transition-shadow">
      <a href={repo.url} target="_blank" rel="noopener noreferrer" className="block">
        <h3 className="font-semibold text-lg text-gray-900 mb-2 hover:text-yellow-600 transition-colors">
          {repo.name}
        </h3>
        {repo.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {repo.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {repo.language && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              {repo.language}
            </span>
          )}
          <span className="flex items-center gap-1">
            ⭐ {repo.stars}
          </span>
          <span className="flex items-center gap-1">
            🔀 {repo.forks}
          </span>
        </div>
      </a>
    </Card>
  );
}

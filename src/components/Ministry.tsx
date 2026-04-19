import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { HandHeart, Music, Shield, Mic2, HeartHandshake, BookOpen } from 'lucide-react';

export function Ministry() {
  const placeholderMinistries = [
    {
      name: 'Choir Ministry',
      description: 'Music and worship team coordinating Sunday and midweek services.',
      icon: Music,
      memberCount: 0,
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
    },
    {
      name: 'Ushering Ministry',
      description: 'Welcoming members and visitors, maintaining order during services.',
      icon: Shield,
      memberCount: 0,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
      name: 'Evangelism Ministry',
      description: 'Outreach and community engagement for spreading the gospel.',
      icon: HeartHandshake,
      memberCount: 0,
      color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6 w-full overflow-x-hidden">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2">
          <HandHeart className="w-6 h-6" />
          Ministry
        </h1>
        <p className="text-muted-foreground">
          Ministry management is coming soon. This tab will support member-linked ministry records.
        </p>
      </div>

      {/* Placeholder Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {placeholderMinistries.map((ministry) => {
          const Icon = ministry.icon;
          return (
            <Card key={ministry.name} className="relative overflow-hidden opacity-75">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ministry.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">
                    Coming Soon
                  </Badge>
                </div>
                <CardTitle className="text-base mt-3">{ministry.name}</CardTitle>
                <CardDescription>{ministry.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{ministry.memberCount} members assigned</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

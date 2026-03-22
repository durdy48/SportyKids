import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const initialSources = [
  { name: 'Marca', url: 'https://feeds.marca.com/rss/portada.xml', sport: 'football' },
  { name: 'AS - Football', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/', sport: 'football' },
  { name: 'AS - Basketball', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/baloncesto/portada/', sport: 'basketball' },
  { name: 'Mundo Deportivo - Football', url: 'https://www.mundodeportivo.com/rss/futbol', sport: 'football' },
];

const initialReels = [
  { title: 'Top 10 La Liga goals 2025', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'football', durationSeconds: 120 },
  { title: 'Lamine Yamal best plays', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'football', team: 'Barcelona', durationSeconds: 90 },
  { title: 'Real Madrid vs Barcelona highlights', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'football', team: 'Real Madrid', durationSeconds: 180 },
  { title: 'Alcaraz: road to Grand Slam', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'tennis', team: 'Carlos Alcaraz', durationSeconds: 150 },
  { title: 'Best ACB three-pointers', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'basketball', durationSeconds: 60 },
  { title: 'Fernando Alonso: fastest lap', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'formula1', team: 'Fernando Alonso', durationSeconds: 45 },
  { title: 'Swimming records 2025', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'swimming', durationSeconds: 90 },
  { title: 'Tour de France: queen stage', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'cycling', durationSeconds: 120 },
  { title: 'Padel World Tour: best points', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'padel', durationSeconds: 75 },
  { title: 'Athletics: 100m world record', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', thumbnailUrl: '', source: 'SportyKids', sport: 'athletics', durationSeconds: 30 },
];

const initialQuestions = [
  { question: 'How many players does a football team have on the field?', options: ['9', '10', '11', '12'], correctAnswer: 2, sport: 'football', points: 10 },
  { question: 'Which team has won the most Champions League titles?', options: ['Barcelona', 'Real Madrid', 'AC Milan', 'Bayern Munich'], correctAnswer: 1, sport: 'football', points: 15 },
  { question: 'In which country was modern football invented?', options: ['Spain', 'Brazil', 'England', 'Italy'], correctAnswer: 2, sport: 'football', points: 10 },
  { question: 'How long is a basketball court?', options: ['20 meters', '24 meters', '28 meters', '30 meters'], correctAnswer: 2, sport: 'basketball', points: 15 },
  { question: 'How many points is a three-pointer worth in basketball?', options: ['1', '2', '3', '4'], correctAnswer: 2, sport: 'basketball', points: 10 },
  { question: 'On what surface is Roland Garros played?', options: ['Grass', 'Clay', 'Hard court', 'Concrete'], correctAnswer: 1, sport: 'tennis', points: 10 },
  { question: 'How many sets do you need to win a men\'s Grand Slam match?', options: ['2', '3', '4', '5'], correctAnswer: 1, sport: 'tennis', points: 15 },
  { question: 'How many laps does a typical F1 race have?', options: ['30-40', '40-50', '50-70', '70-80'], correctAnswer: 2, sport: 'formula1', points: 15 },
  { question: 'What is the fastest swimming style?', options: ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle'], correctAnswer: 3, sport: 'swimming', points: 10 },
  { question: 'How long is an Olympic swimming pool?', options: ['25m', '33m', '50m', '100m'], correctAnswer: 2, sport: 'swimming', points: 10 },
  { question: 'How many stages does the Tour de France have approximately?', options: ['15', '18', '21', '25'], correctAnswer: 2, sport: 'cycling', points: 15 },
  { question: 'What country is Carlos Alcaraz from?', options: ['Argentina', 'Spain', 'Italy', 'France'], correctAnswer: 1, sport: 'tennis', points: 10 },
  { question: 'Which team plays at the Santiago Bernabeu?', options: ['Atletico de Madrid', 'Barcelona', 'Real Madrid', 'Sevilla FC'], correctAnswer: 2, sport: 'football', points: 10 },
  { question: 'How long is an NBA basketball game?', options: ['40 minutes', '48 minutes', '50 minutes', '60 minutes'], correctAnswer: 1, sport: 'basketball', points: 15 },
  { question: 'Which sport is played with a paddle and ball on an enclosed court?', options: ['Tennis', 'Squash', 'Padel', 'Badminton'], correctAnswer: 2, sport: 'padel', points: 10 },
];

async function main() {
  console.log('Seeding RSS sources...');
  for (const source of initialSources) {
    await prisma.rssSource.upsert({
      where: { url: source.url },
      update: { name: source.name, sport: source.sport },
      create: source,
    });
    console.log(`  + ${source.name}`);
  }

  console.log('\nSeeding reels...');
  for (const reel of initialReels) {
    const existing = await prisma.reel.findFirst({ where: { title: reel.title } });
    if (!existing) {
      await prisma.reel.create({ data: reel });
      console.log(`  + ${reel.title}`);
    }
  }

  console.log('\nSeeding quiz questions...');
  for (const q of initialQuestions) {
    const existing = await prisma.quizQuestion.findFirst({ where: { question: q.question } });
    if (!existing) {
      await prisma.quizQuestion.create({
        data: { ...q, options: JSON.stringify(q.options) },
      });
      console.log(`  + ${q.question.substring(0, 50)}...`);
    }
  }

  console.log('\nSeed completed.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

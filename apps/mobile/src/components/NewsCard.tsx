import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import type { NewsItem } from '@sportykids/shared';
import { sportToEmoji, formatDate, COLORS, t } from '@sportykids/shared';
import type { Locale } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { getSportLabel } from '@sportykids/shared';

interface NewsCardProps {
  item: NewsItem;
}

export function NewsCard({ item }: NewsCardProps) {
  const { locale } = useUser();

  return (
    <View style={styles.card}>
      {item.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {sportToEmoji(item.sport)} {getSportLabel(item.sport, locale)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {item.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {item.summary}
          </Text>
        ) : null}

        <View style={styles.meta}>
          <Text style={styles.source}>{item.source}</Text>
          <Text style={styles.separator}>&middot;</Text>
          <Text style={styles.date}>{formatDate(item.publishedAt, locale)}</Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL(item.sourceUrl)}
        >
          <Text style={styles.buttonText}>{t('buttons.read_more', locale)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    height: 180,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 6,
    lineHeight: 22,
  },
  summary: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 10,
    lineHeight: 18,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  source: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  separator: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 6,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  button: {
    backgroundColor: COLORS.blue,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

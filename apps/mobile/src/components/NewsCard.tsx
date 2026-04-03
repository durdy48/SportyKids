import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet, Animated, LayoutAnimation, ActivityIndicator } from 'react-native';
import type { NewsItem } from '@sportykids/shared';
import { sportToEmoji, formatDate, COLORS, t } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { useUser } from '../lib/user-context';
import { getSportLabel } from '@sportykids/shared';
import { isFavorite, toggleFavorite } from '../lib/favorites';
import { fetchRelatedArticles, fetchNewsSummary } from '../lib/api';

interface NewsCardProps {
  item: NewsItem;
  isTrending?: boolean;
}

export function NewsCard({ item, isTrending = false }: NewsCardProps) {
  const { locale, colors, user } = useUser();
  const styles = createStyles(colors);
  const [liked, setLiked] = useState(false);
  const [related, setRelated] = useState<NewsItem[]>([]);
  const [showRelated, setShowRelated] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Explain it Easy state
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    summary: string;
    ageRange: string;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const summaryFetched = useRef(false);

  useEffect(() => {
    isFavorite(item.id).then(setLiked);
  }, [item.id]);

  const handleToggleFavorite = async () => {
    const result = await toggleFavorite(item.id);
    setLiked(result);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handleExplain = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !showSummary;
    setShowSummary(next);

    if (next && !summaryFetched.current) {
      summaryFetched.current = true;
      setSummaryLoading(true);
      setSummaryError(false);
      try {
        const age = user?.age ?? 10; // default to 9-11 age range when age is unavailable (matches web's userAge derivation)
        const data = await fetchNewsSummary(item.id, age, locale);
        if (data.summary) {
          setSummaryData({ summary: data.summary, ageRange: data.ageRange });
        } else {
          setSummaryError(true);
        }
      } catch {
        setSummaryError(true);
      } finally {
        setSummaryLoading(false);
      }
    }
  };

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
          {/* Heart button */}
          <Animated.View style={[styles.heartButton, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
              onPress={handleToggleFavorite}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel={t(liked ? 'a11y.news_card.unsave' : 'a11y.news_card.save', locale)}
              accessibilityRole="button"
              accessibilityState={{ selected: liked }}
              accessibilityHint={t('a11y.news_card.save_hint', locale)}
            >
              <Text style={styles.heartIcon}>{liked ? '\u2764\uFE0F' : '\u{1F90D}'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : null}

      <View style={styles.content}>
        {/* Heart button when no image */}
        {!item.imageUrl && (
          <Animated.View style={[styles.heartButtonNoImage, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
              onPress={handleToggleFavorite}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel={t(liked ? 'a11y.news_card.unsave' : 'a11y.news_card.save', locale)}
              accessibilityRole="button"
              accessibilityState={{ selected: liked }}
            >
              <Text style={styles.heartIcon}>{liked ? '\u2764\uFE0F' : '\u{1F90D}'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

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
          {isTrending && (
            <View style={styles.trendingBadge} accessibilityLabel={t('a11y.news_card.trending', locale)}>
              <Text style={styles.trendingText}>{'\uD83D\uDD25'} {t('news.trending', locale)}</Text>
            </View>
          )}
        </View>

        {/* Action buttons row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.readButton}
            accessible={true}
            accessibilityLabel={t('a11y.news_card.read', locale, { title: item.title })}
            accessibilityRole="link"
            onPress={() => {
              Linking.openURL(item.sourceUrl);
              if (!showRelated && related.length === 0) {
                fetchRelatedArticles(item.id, 3).then((res) => {
                  setRelated(res.related);
                  if (res.related.length > 0) setShowRelated(true);
                }).catch(() => {});
              }
            }}
          >
            <Text style={styles.readButtonText}>{t('buttons.read_more', locale)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.explainButton, showSummary && styles.explainButtonActive]}
            onPress={handleExplain}
            accessible={true}
            accessibilityRole="button"
            accessibilityState={{ expanded: showSummary }}
            accessibilityLabel={t('summary.explain_easy', locale)}
            accessibilityHint={t('a11y.news_card.explain_hint', locale)}
          >
            <Text style={[styles.explainButtonText, showSummary && styles.explainButtonTextActive]}>
              {'\u2728'} {t('summary.explain_easy', locale)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Summary panel */}
        {showSummary && (
          <View style={styles.summaryPanel}>
            {summaryLoading && (
              <View style={styles.summaryLoading}>
                <ActivityIndicator size="small" color={COLORS.blue} />
                <Text style={styles.summaryLoadingText}>{t('summary.loading', locale)}</Text>
              </View>
            )}

            {summaryError && !summaryLoading && (
              <Text style={styles.summaryError}>{t('summary.error', locale)}</Text>
            )}

            {summaryData && !summaryLoading && !summaryError && (
              <View>
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeText}>
                    {t('summary.adapted_for_age', locale, { range: summaryData.ageRange })}
                  </Text>
                </View>
                <Text style={styles.summaryText}>{summaryData.summary}</Text>
              </View>
            )}
          </View>
        )}

        {/* Related articles */}
        {showRelated && related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>{t('related.title', locale)}</Text>
            {related.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.relatedItem}
                onPress={() => Linking.openURL(r.sourceUrl)}
                accessible={true}
                accessibilityLabel={t('a11y.news_card.read', locale, { title: r.title })}
                accessibilityRole="link"
              >
                <Text style={styles.relatedEmoji}>{sportToEmoji(r.sport)}</Text>
                <Text style={styles.relatedText} numberOfLines={1}>{r.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
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
    color: colors.text,
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
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  readButton: {
    flex: 1,
    backgroundColor: COLORS.blue,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  readButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  explainButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  explainButtonActive: {
    backgroundColor: '#FACC15',
    borderColor: '#FACC15',
  },
  explainButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  explainButtonTextActive: {
    color: '#1E293B',
  },
  summaryPanel: {
    marginTop: 8,
    backgroundColor: colors.background,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.blue,
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLoadingText: {
    fontSize: 12,
    color: colors.muted,
  },
  summaryError: {
    fontSize: 13,
    color: colors.muted,
  },
  summaryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#22C55E',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  summaryText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  heartButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButtonNoImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  heartIcon: {
    fontSize: 16,
  },
  trendingBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  trendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EA580C',
  },
  relatedSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  relatedTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  relatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  relatedEmoji: {
    fontSize: 12,
  },
  relatedText: {
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  });
}

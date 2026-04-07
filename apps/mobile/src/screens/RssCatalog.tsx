import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RssSource } from '@sportykids/shared';
import { COLORS, t, getSportLabel, sportToEmoji } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { fetchSourceCatalog, updateUser } from '../lib/api';
import { useUser } from '../lib/user-context';

type SectionType = 'selected' | 'catalog';

interface Section {
  title: string;
  key: string;
  data: (RssSource & { _sectionType: SectionType })[];
}

interface Props {
  navigation: NativeStackNavigationProp<Record<string, object | undefined>, string>;
}

export function RssCatalogScreen({ navigation }: Props) {
  const { user, locale, setUser, colors } = useUser();
  const styles = createStyles(colors);
  const [sources, setSources] = useState<RssSource[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    loadCatalog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.selectedFeeds) {
      setSelectedIds(new Set(user.selectedFeeds));
    }
  }, [user?.selectedFeeds]);

  const loadCatalog = async () => {
    try {
      const result = await fetchSourceCatalog();
      setSources(result.sources);
    } catch {
      Alert.alert(t('errors.connection_error', locale));
    } finally {
      setLoading(false);
    }
  };

  // Compute sections: "Activas" first, then unselected grouped by language > sport
  const sections = useMemo((): Section[] => {
    const selected = sources.filter((s) => selectedIds.has(s.id));
    const unselected = sources.filter((s) => !selectedIds.has(s.id));

    const result: Section[] = [];

    if (selected.length > 0) {
      const sorted = [...selected].sort((a, b) =>
        getSportLabel(a.sport, locale).localeCompare(getSportLabel(b.sport, locale))
      );
      result.push({
        title: `✅ ${t('sources.active_section', locale)} (${selected.length})`,
        key: 'selected',
        data: sorted.map((s) => ({ ...s, _sectionType: 'selected' as const })),
      });
    }

    // Group unselected by language then sport
    const byLangSport: Record<string, Record<string, RssSource[]>> = {};
    for (const source of unselected) {
      const lang = source.language?.toLowerCase() ?? 'es';
      if (!byLangSport[lang]) byLangSport[lang] = {};
      if (!byLangSport[lang][source.sport]) byLangSport[lang][source.sport] = [];
      byLangSport[lang][source.sport].push(source);
    }

    const langOrder = ['es', 'en'];
    const otherLangs = Object.keys(byLangSport).filter((l) => !langOrder.includes(l)).sort();
    const orderedLangs = [...langOrder.filter((l) => byLangSport[l]), ...otherLangs];

    const getLangLabel = (lang: string) => {
      if (lang === 'es') return '🇪🇸 Español';
      if (lang === 'en') return '🇬🇧 English';
      return lang.toUpperCase();
    };

    for (const lang of orderedLangs) {
      const sportGroups = byLangSport[lang];
      const sortedSports = Object.keys(sportGroups).sort((a, b) =>
        getSportLabel(a, locale).localeCompare(getSportLabel(b, locale))
      );
      for (const sport of sortedSports) {
        result.push({
          title: `${getLangLabel(lang)} · ${sportToEmoji(sport)} ${getSportLabel(sport, locale)}`,
          key: `${lang}-${sport}`,
          data: sportGroups[sport].map((s) => ({ ...s, _sectionType: 'catalog' as const })),
        });
      }
    }

    return result;
  }, [sources, selectedIds, locale]);

  const toggleSource = useCallback((sourceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
    setDirty(true);
    setSavedSuccess(false);
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateUser(user.id, {
        selectedFeeds: Array.from(selectedIds),
      });
      setDirty(false);
      setSavedSuccess(true);
      // Navigate back BEFORE setUser to prevent navigation stack reset
      navigation.goBack();
      setUser(updated);
    } catch {
      Alert.alert(t('errors.connection_error', locale));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: RssSource & { _sectionType: SectionType } }) => (
    <View style={styles.sourceCard}>
      <View style={styles.sourceInfo}>
        <View style={styles.sourceNameRow}>
          {item._sectionType === 'selected' && (
            <Text style={styles.sportEmoji}>{sportToEmoji(item.sport)} </Text>
          )}
          <Text style={styles.sourceName} numberOfLines={1}>{item.name}</Text>
        </View>
        {item.description ? (
          <Text style={styles.sourceDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.sourceMeta}>
          <Text style={styles.sourceMetaText}>
            {item.country} · {item.language.toUpperCase()}
          </Text>
          {item.isCustom && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>{t('sources.custom_badge', locale)}</Text>
            </View>
          )}
        </View>
      </View>
      <Switch
        value={selectedIds.has(item.id)}
        onValueChange={() => toggleSource(item.id)}
        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
        thumbColor={selectedIds.has(item.id) ? colors.blue : colors.border}
        accessibilityLabel={t('a11y.catalog.toggle_source', locale, {
          source: item.name,
          state: selectedIds.has(item.id)
            ? t('a11y.catalog.source_enabled', locale)
            : t('a11y.catalog.source_disabled', locale),
        })}
        accessibilityRole="switch"
      />
    </View>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, section.key === 'selected' && styles.sectionHeaderSelected]}>
      <Text style={[styles.sectionTitle, section.key === 'selected' && styles.sectionTitleSelected]}>
        {section.title}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: dirty ? 80 : 20 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('sources.catalog_title', locale)}</Text>
            <Text style={styles.headerSubtitle}>{t('sources.catalog_subtitle', locale)}</Text>
            {savedSuccess && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✓ {t('notifications.saved', locale)}</Text>
              </View>
            )}
          </View>
        }
      />
      {dirty && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
            accessible={true}
            accessibilityLabel={t('favorites.save', locale)}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {t('sources.selected_count', locale).replace('{{count}}', String(selectedIds.size))} —{' '}
                {t('favorites.save', locale)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.muted,
      marginTop: 4,
    },
    successBanner: {
      marginTop: 10,
      backgroundColor: COLORS.green + '20',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.green + '40',
    },
    successText: {
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.green,
    },
    sectionHeader: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionHeaderSelected: {
      backgroundColor: COLORS.blue + '10',
      borderBottomColor: COLORS.blue + '30',
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionTitleSelected: {
      color: COLORS.blue,
    },
    sourceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sourceInfo: {
      flex: 1,
      marginRight: 12,
    },
    sourceNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sportEmoji: {
      fontSize: 14,
    },
    sourceName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    sourceDescription: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    sourceMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 8,
    },
    sourceMetaText: {
      fontSize: 12,
      color: colors.muted,
    },
    customBadge: {
      backgroundColor: COLORS.blue + '15',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    customBadgeText: {
      fontSize: 11,
      fontWeight: '500',
      color: COLORS.blue,
    },
    saveBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    saveButton: {
      backgroundColor: COLORS.blue,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
  });
}

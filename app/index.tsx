import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/ui/theme';
import { strings } from '@/ui/strings';
import { useDecks } from '@/decks/useDecks';
import { DecksScreen } from '@/ui/DecksScreen';
import { useToday } from '@/today/useToday';
import { TodayView } from '@/ui/TodayView';
import { useStats } from '@/stats/useStats';
import { StatsView } from '@/ui/StatsView';

import { isOnboardingCompleted } from '@/onboarding/onboardingService';
import { logError } from '@/logging';

export type MainTab = 'today' | 'decks' | 'stats';

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<MainTab>('today');
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const {
    summary,
    continueReading: todayContinueReading,
    loading: todayLoading,
    refresh: refreshToday,
  } = useToday();

  const {
    stats,
    loading: statsLoading,
    refresh: refreshStats,
  } = useStats({ heatmapWeeks: 20 });

  const {
    tree,
    allDecks,
    loading: decksLoading,
    refresh: refreshDecks,
    createDeck,
    renameDeck,
    moveDeck,
    deleteDeck,
    restoreDeck,
  } = useDecks();

  useFocusEffect(
    useCallback(() => {
      try {
        const completed = isOnboardingCompleted();
        if (!completed) {
          router.replace('/onboarding' as unknown as Parameters<typeof router.replace>[0]);
          return;
        }
      } catch (err) {
        logError('HomeScreenOnboardingCheck', err);
      }
      setOnboardingChecked(true);
      refreshToday();
      refreshDecks();
      refreshStats();
    }, [refreshToday, refreshDecks, refreshStats, router])
  );

  const handleSelectDeck = (deckId: string) => {
    router.push(`/deck/${deckId}`);
  };

  const handleStudyToday = () => {
    router.push('/review');
  };

  const handleContinueReading = (deckId: string) => {
    if (todayContinueReading && todayContinueReading.deckId === deckId) {
      router.push({
        pathname: '/consulta/[id]',
        params: {
          id: deckId,
          unitIndex: String(todayContinueReading.unitIndex),
          offset: String(todayContinueReading.offset ?? 0),
        },
      });
    } else {
      router.push(`/consulta/${deckId}`);
    }
  };

  if (!onboardingChecked) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme.canvas,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
        edges={['top', 'bottom']}
      >
        <ActivityIndicator size="small" color={theme.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        {activeTab === 'today' ? (
          <TodayView
            summary={summary}
            continueReading={todayContinueReading}
            loading={todayLoading}
            onRefresh={refreshToday}
            onStudy={handleStudyToday}
            onOpenDecks={() => setActiveTab('decks')}
            onOpenStats={() => setActiveTab('stats')}
            onContinueReading={handleContinueReading}
            onSettingsPress={() =>
              router.push('/settings' as unknown as Parameters<typeof router.push>[0])
            }
          />
        ) : activeTab === 'decks' ? (
          <DecksScreen
            tree={tree}
            allDecks={allDecks}
            loading={decksLoading}
            continueReading={todayContinueReading}
            onRefresh={() => {
              refreshDecks();
              refreshToday();
            }}
            onSelectDeck={handleSelectDeck}
            onContinueReading={handleContinueReading}
            onCreateDeck={(name, description) => createDeck({ name, description })}
            onRenameDeck={(deckId, newName) => renameDeck(deckId, newName)}
            onMoveDeck={(deckId, newParentId) => moveDeck(deckId, newParentId)}
            onDeleteDeck={(deckId) => deleteDeck(deckId)}
            onRestoreDeck={(deckId) => restoreDeck(deckId)}
            onImportPress={() =>
              router.push('/import' as unknown as Parameters<typeof router.push>[0])
            }
            onSettingsPress={() =>
              router.push('/settings' as unknown as Parameters<typeof router.push>[0])
            }
          />
        ) : (
          <StatsView
            stats={stats}
            loading={statsLoading}
            onRefresh={refreshStats}
            onSettingsPress={() =>
              router.push('/settings' as unknown as Parameters<typeof router.push>[0])
            }
          />
        )}
      </View>

      {/* Barra de navegação inferior com abas */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.elevated,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('today')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'today' }}
          accessibilityLabel={strings.tabs.today}
          accessibilityHint={strings.tabs.todayHint}
        >
          <Text
            style={[
              styles.tabIcon,
              { color: activeTab === 'today' ? theme.accent : theme.fgMuted },
            ]}
          >
            ☀️
          </Text>
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'today' ? theme.accent : theme.fgMuted,
                fontWeight: activeTab === 'today' ? '700' : '500',
              },
            ]}
          >
            {strings.tabs.today}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('decks')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'decks' }}
          accessibilityLabel={strings.tabs.decks}
          accessibilityHint={strings.tabs.decksHint}
        >
          <Text
            style={[
              styles.tabIcon,
              { color: activeTab === 'decks' ? theme.accent : theme.fgMuted },
            ]}
          >
            📚
          </Text>
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'decks' ? theme.accent : theme.fgMuted,
                fontWeight: activeTab === 'decks' ? '700' : '500',
              },
            ]}
          >
            {strings.tabs.decks}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('stats')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'stats' }}
          accessibilityLabel={strings.tabs.stats}
          accessibilityHint={strings.tabs.statsHint}
        >
          <Text
            style={[
              styles.tabIcon,
              { color: activeTab === 'stats' ? theme.accent : theme.fgMuted },
            ]}
          >
            📊
          </Text>
          <Text
            style={[
              styles.tabLabel,
              {
                color: activeTab === 'stats' ? theme.accent : theme.fgMuted,
                fontWeight: activeTab === 'stats' ? '700' : '500',
              },
            ]}
          >
            {strings.tabs.stats}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    height: 60,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 12,
  },
});

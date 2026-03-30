import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export const navigationRef = createNavigationContainerRef();
import { Text, TouchableOpacity } from 'react-native';
import { t } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { haptic } from '../lib/haptics';
import { HomeFeedScreen } from '../screens/HomeFeed';
import { ReelsScreen } from '../screens/Reels';
import { QuizScreen } from '../screens/Quiz';
import { CollectionScreen } from '../screens/Collection';
import { FavoriteTeamScreen } from '../screens/FavoriteTeam';
import { ParentalControlScreen } from '../screens/ParentalControl';
import { OnboardingScreen } from '../screens/Onboarding';
import { RssCatalogScreen } from '../screens/RssCatalog';
import { LoginScreen } from '../screens/Login';
import { RegisterScreen } from '../screens/Register';
import { AgeGateScreen } from '../screens/AgeGate';
import { ScheduleLockGuard } from '../components/ScheduleLockGuard';

// Wrap content screens with schedule lock guard (Parents tab stays accessible)
function GuardedHomeFeed(props: { navigation: { navigate: (s: string) => void } }) {
  return <ScheduleLockGuard><HomeFeedScreen {...props} /></ScheduleLockGuard>;
}
function GuardedReels() {
  return <ScheduleLockGuard><ReelsScreen /></ScheduleLockGuard>;
}
function GuardedQuiz() {
  return <ScheduleLockGuard><QuizScreen /></ScheduleLockGuard>;
}
function GuardedCollection() {
  return <ScheduleLockGuard><CollectionScreen /></ScheduleLockGuard>;
}
function GuardedFavoriteTeam() {
  return <ScheduleLockGuard><FavoriteTeamScreen /></ScheduleLockGuard>;
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function LanguageToggle() {
  const { locale, setLocale, colors } = useUser();
  const nextLocale = locale === 'es' ? 'en' : 'es';
  const flag = locale === 'es' ? '🇪🇸' : '🇬🇧';
  return (
    <TouchableOpacity
      onPress={() => setLocale(nextLocale)}
      style={{ marginRight: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.border }}
    >
      <Text style={{ fontSize: 16 }}>{flag}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginLeft: 4 }}>{locale.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
  const { locale, colors } = useUser();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontWeight: '600', fontSize: 18, color: colors.text },
        headerStyle: { backgroundColor: colors.surface },
        headerRight: () => <LanguageToggle />,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
      screenListeners={{
        tabPress: () => haptic('selection'),
      }}
    >
      <Tab.Screen
        name="HomeFeed"
        component={GuardedHomeFeed}
        options={{
          title: t('nav.news', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>📰</Text>,
        }}
      />
      <Tab.Screen
        name="Reels"
        component={GuardedReels}
        options={{
          title: t('nav.reels', locale),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🎬</Text>,
        }}
      />
      <Tab.Screen
        name="Quiz"
        component={GuardedQuiz}
        options={{
          title: t('nav.quiz', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🧠</Text>,
        }}
      />
      <Tab.Screen
        name="Collection"
        component={GuardedCollection}
        options={{
          title: t('nav.collection', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🏆</Text>,
        }}
      />
      <Tab.Screen
        name="FavoriteTeam"
        component={GuardedFavoriteTeam}
        options={{
          title: t('nav.my_team', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>⚽</Text>,
        }}
      />
      <Tab.Screen
        name="Parents"
        component={ParentalControlScreen}
        options={{
          title: t('nav.parents', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🔒</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading, locale } = useUser();

  if (loading) return null;

  const needsAgeGate = user && user.ageGateCompleted === false;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user && !needsAgeGate ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="RssCatalog"
              component={RssCatalogScreen}
              options={{
                headerShown: true,
                title: t('sources.catalog_title', locale),
              }}
            />
          </>
        ) : needsAgeGate ? (
          <>
            <Stack.Screen name="AgeGate" component={AgeGateScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="AgeGate" component={AgeGateScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

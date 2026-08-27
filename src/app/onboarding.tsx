import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CityPicker } from '@/components/city-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  bornOnFromParts,
  signupAgeMessage,
  UNDER_16_MESSAGE,
} from '@/lib/age';
import { createMe, errorMessageForHandle, TalkStyle } from '@/lib/me';
import { slugifyCity } from '@/lib/around/slug';
import { DEFAULT_AROUND_CITY } from '@/constants/around-cities';
import { useMeContext } from '@/lib/me-context';
import {
  fetchSignupMode,
  getPendingInviteCode,
  type SignupMode,
} from '@/lib/invite';
import { clearLocalSession } from '@/lib/supabase';
import { withTimeout } from '@/lib/timeout';

const RESERVED_HANDLES = ['ato', 'sage', 'admin', 'support', 'you', 'astrollogs'];

const TALK_STYLES: { value: TalkStyle; label: string }[] = [
  { value: 'quiet', label: 'Quiet' },
  { value: 'even', label: 'Even' },
  { value: 'loud', label: 'Loud' },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const { refresh } = useMeContext();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [showUp, setShowUp] = useState('');
  const [talkStyle, setTalkStyle] = useState<TalkStyle | null>(null);
  const [knocksYouOff, setKnocksYouOff] = useState('');
  const [morningCue, setMorningCue] = useState('');
  const [city, setCity] = useState(DEFAULT_AROUND_CITY.slug);
  const [inviteCode, setInviteCode] = useState('');
  const [signupMode, setSignupMode] = useState<SignupMode>('invite_only');

  const [handleError, setHandleError] = useState<string | null>(null);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const timezone =
    (typeof Intl !== 'undefined' &&
      Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'UTC';

  useEffect(() => {
    let active = true;
    Promise.all([fetchSignupMode(), getPendingInviteCode()])
      .then(([mode, pending]) => {
        if (!active) return;
        setSignupMode(mode);
        if (pending) setInviteCode(pending);
      })
      .catch(() => {
        // Fail closed on mode; invite field stays visible via default.
      });
    return () => {
      active = false;
    };
  }, []);

  function normalizeHandle(raw: string): string {
    return raw.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
  }

  async function submit() {
    const trimmedName = name.trim();
    const normalizedHandle = normalizeHandle(handle);
    const trimmedShowUp = showUp.trim();
    const trimmedKnocks = knocksYouOff.trim();
    const trimmedCue = morningCue.trim();

    const parsedBornOn = bornOnFromParts(birthYear, birthMonth, birthDay);
    if (!parsedBornOn.ok) {
      setAgeError(parsedBornOn.message);
      setFormError(null);
      return;
    }
    const ageBlock = signupAgeMessage(parsedBornOn.bornOn);
    if (ageBlock) {
      setAgeError(ageBlock);
      setFormError(null);
      return;
    }

    if (!trimmedName) {
      setFormError('Tell us what to call you.');
      return;
    }
    if (!normalizedHandle) {
      setHandleError('Pick a handle.');
      return;
    }
    if (RESERVED_HANDLES.includes(normalizedHandle)) {
      setHandleError('That handle is reserved.');
      return;
    }
    if (!trimmedShowUp) {
      setFormError('What are you in this week?');
      return;
    }
    if (!talkStyle) {
      setFormError('Pick a talk style.');
      return;
    }
    if (!trimmedKnocks) {
      setFormError('What usually knocks you off?');
      return;
    }
    if (!trimmedCue) {
      setFormError('What do you already do every morning?');
      return;
    }

    setFormError(null);
    setHandleError(null);
    setAgeError(null);
    if (busy) return; // prevent double-tap while a save is in flight
    setBusy(true);
    console.log('[onboarding] submit start');

    try {
      await withTimeout(
        createMe({
          name: trimmedName,
          handle: normalizedHandle,
          show_up: trimmedShowUp,
          talk_style: talkStyle,
          knocks_you_off: trimmedKnocks,
          morning_cue: trimmedCue,
          timezone,
          invite_code: inviteCode,
          born_on: parsedBornOn.bornOn,
          city: slugifyCity(city) ?? DEFAULT_AROUND_CITY.slug,
        }),
        15000,
        'createMe',
      );
      console.log('[onboarding] createMe succeeded');

      // Row exists now. Refresh the shared ME state so the root guard flips
      // hasMe and routes to (tabs) declaratively.
      await withTimeout(refresh(), 15000, 'refresh');
      console.log('[onboarding] refresh done');
    } catch (err) {
      // TEMP debug: capture the raw insert error for diagnosis
      const e = err as { message?: string; code?: string; details?: string; hint?: string };
      console.log('[onboarding] createMe raw error:', JSON.stringify(e));
      console.log('[onboarding] message:', e.message, '| code:', e.code, '| details:', e.details, '| hint:', e.hint);
      const message = errorMessageForHandle(err);
      if (message.startsWith('That handle')) {
        setHandleError(message);
      } else if (message === UNDER_16_MESSAGE || message.startsWith('When were you born') || message.includes('real date')) {
        setAgeError(message);
      } else {
        setFormError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (signingOut || busy) return;
    setSigningOut(true);
    await clearLocalSession();
    setSigningOut(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">Introduce yourself</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lede}>
              A few quick questions, then ATO knows how to talk to you.
            </ThemedText>

            {signupMode === 'invite_only' ? (
              <Field
                label="Invite code"
                required
                hint="Required for a new account. Returning sign-in does not need one.">
                <TextInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Invite code"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!busy}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundSelected },
                  ]}
                />
              </Field>
            ) : null}

            <Pressable
              onPress={handleSignOut}
              disabled={signingOut || busy}
              style={({ pressed }) => [
                styles.signOutLink,
                pressed && styles.pressed,
                (signingOut || busy) && styles.disabled,
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                {signingOut ? 'Signing out…' : 'Wrong account? Sign out'}
              </ThemedText>
            </Pressable>

            <Field
              label="1. When were you born?"
              required
              error={ageError}
              hint="Day, month, and year. ATO is for people 16 and older.">
              <View style={styles.dateRow}>
                <TextInput
                  value={birthYear}
                  onChangeText={(text) => {
                    setBirthYear(text.replace(/\D/g, '').slice(0, 4));
                    setAgeError(null);
                  }}
                  placeholder="YYYY"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={4}
                  editable={!busy}
                  style={[styles.input, styles.dateYear, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                />
                <TextInput
                  value={birthMonth}
                  onChangeText={(text) => {
                    setBirthMonth(text.replace(/\D/g, '').slice(0, 2));
                    setAgeError(null);
                  }}
                  placeholder="MM"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                  editable={!busy}
                  style={[styles.input, styles.datePart, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                />
                <TextInput
                  value={birthDay}
                  onChangeText={(text) => {
                    setBirthDay(text.replace(/\D/g, '').slice(0, 2));
                    setAgeError(null);
                  }}
                  placeholder="DD"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={2}
                  editable={!busy}
                  style={[styles.input, styles.datePart, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                />
              </View>
            </Field>

            <Field label="2. What should we call you?" required>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                editable={!busy}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              />
            </Field>

            <Field
              label="3. Unique @handle"
              required
              error={handleError}
              hint="Letters and numbers only. Reserved: ato, sage, admin, support, you, astrollogs.">
              <View style={styles.handleRow}>
                <TextInput
                  value={handle}
                  onChangeText={(text) => {
                    setHandle(normalizeHandle(text));
                    setHandleError(null);
                  }}
                  placeholder="yourhandle"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  style={[styles.input, styles.handleInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                />
                {handle.length > 0 ? (
                  <ThemedText type="code" themeColor="textSecondary" style={styles.handleAt}>
                    @{handle}
                  </ThemedText>
                ) : null}
              </View>
            </Field>

            <Field label="4. What are you in this week?" required>
              <TextInput
                value={showUp}
                onChangeText={setShowUp}
                placeholder="e.g. finishing my resume, 3 runs, being less online"
                placeholderTextColor={theme.textSecondary}
                editable={!busy}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              />
            </Field>

            <Field label="5. Talk style" required>
              <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
                {TALK_STYLES.map((option) => {
                  const selected = talkStyle === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setTalkStyle(option.value)}
                      disabled={busy}
                      style={[
                        styles.segment,
                        { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
                      ]}>
                      <ThemedText type="small" themeColor={selected ? 'text' : 'textSecondary'}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="6. What usually knocks you off?" required>
              <TextInput
                value={knocksYouOff}
                onChangeText={setKnocksYouOff}
                placeholder="e.g. bad sleep, my phone, saying yes to too much"
                placeholderTextColor={theme.textSecondary}
                editable={!busy}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              />
            </Field>

            <Field label="7. What do you already do every morning?" required>
              <TextInput
                value={morningCue}
                onChangeText={setMorningCue}
                placeholder="e.g. making coffee, brushing teeth, checking my phone"
                placeholderTextColor={theme.textSecondary}
                editable={!busy}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
              />
            </Field>

            <Field
              label="8. What city do you go out in?"
              required
              hint="Typed, not GPS. Around uses this for the weekend list. Calgary is what we refresh today.">
              <CityPicker compact value={city} onChange={(slug) => setCity(slug ?? DEFAULT_AROUND_CITY.slug)} />
            </Field>

            {formError ? (
              <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
                {formError}
              </ThemedText>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: '#3c87f7' },
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}>
              <ThemedText type="smallBold" style={styles.submitText}>
                {busy ? 'Saving…' : 'Save'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">
        {label}
        {required ? <ThemedText type="small" themeColor="textSecondary"> *</ThemedText> : null}
      </ThemedText>
      {children}
      {hint ? (
        <ThemedText type="code" themeColor="textSecondary" style={styles.hint}>
          {hint}
        </ThemedText>
      ) : null}
      {error ? (
        <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  lede: {
    paddingBottom: Spacing.two,
  },
  signOutLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dateYear: {
    flex: 1.2,
  },
  datePart: {
    flex: 1,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  handleInput: {
    flex: 1,
  },
  handleAt: {
    paddingRight: Spacing.two,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  hint: {
    lineHeight: 18,
  },
  submitButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});

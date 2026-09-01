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

import { BornOnFields } from '@/components/born-on-fields';
import { CityPicker } from '@/components/city-picker';
import { CoreIntakeSweep } from '@/components/core-intake-sweep';
import { IntakeSweep } from '@/components/intake-sweep';
import { OptionalGate, OptionalStep } from '@/components/optional-intake';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  bornOnFromParts,
  signupAgeMessage,
  UNDER_16_MESSAGE,
} from '@/lib/age';
import {
  joinKnocks,
  type CoreIntakeField,
  type CurrentFocus,
  type EnergyPattern,
  type KnocksChip,
  type RecoveryStyle,
  type SupportStyle,
} from '@/lib/intake';
import { createMe, errorMessageForHandle, fetchMe, TalkStyle, updateTraits, checkHandleAvailable, handleFormatError, normalizeHandle, type Me } from '@/lib/me';
import { OPTIONAL_INTAKE_TOTAL, SLIDER_AXES, writeForOptionalScreen, type OptionalScreen } from '@/lib/traits';
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

type Phase = 'account' | 'intake' | 'optional-gate' | 'optional' | 'sweep';

export default function OnboardingScreen() {
  const theme = useTheme();
  const { refresh } = useMeContext();

  const [phase, setPhase] = useState<Phase>('account');
  const [optionalIndex, setOptionalIndex] = useState(0);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [meRow, setMeRow] = useState<Me | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [sliderValues, setSliderValues] = useState<Partial<Record<(typeof SLIDER_AXES)[number], number>>>({});
  const [closeId, setCloseId] = useState<string | null>(null);
  const [closeSecondId, setCloseSecondId] = useState<string | null>(null);
  const [disagreeId, setDisagreeId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [city, setCity] = useState(DEFAULT_AROUND_CITY.slug);
  const [inviteCode, setInviteCode] = useState('');
  const [signupMode, setSignupMode] = useState<SignupMode>('invite_only');

  const [talkStyle, setTalkStyle] = useState<TalkStyle | null>(null);
  const [showUp, setShowUp] = useState<string | null>(null);
  const [knocksYouOff, setKnocksYouOff] = useState<KnocksChip[]>([]);
  const [morningCue, setMorningCue] = useState<string | null>(null);
  const [eveningWindDown, setEveningWindDown] = useState<string | null>(null);
  const [energyPattern, setEnergyPattern] = useState<EnergyPattern | null>(null);
  const [recoveryStyle, setRecoveryStyle] = useState<RecoveryStyle | null>(null);
  const [supportStyle, setSupportStyle] = useState<SupportStyle | null>(null);
  const [currentFocus, setCurrentFocus] = useState<CurrentFocus | null>(null);

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

  function validateAccount(): boolean {
    const trimmedName = name.trim();

    const parsedBornOn = bornOnFromParts(birthYear, birthMonth, birthDay);
    if (!parsedBornOn.ok) {
      setAgeError(parsedBornOn.message);
      setFormError(null);
      return false;
    }
    const ageBlock = signupAgeMessage(parsedBornOn.bornOn);
    if (ageBlock) {
      setAgeError(ageBlock);
      setFormError(null);
      return false;
    }

    if (!trimmedName) {
      setFormError('Tell us what to call you.');
      return false;
    }
    const handleMsg = handleFormatError(handle);
    if (handleMsg) {
      setHandleError(handleMsg);
      return false;
    }

    setFormError(null);
    setHandleError(null);
    setAgeError(null);
    return true;
  }

  async function continueFromAccount() {
    if (!validateAccount()) return;
    if (busy) return;
    setBusy(true);
    try {
      const result = await checkHandleAvailable(handle);
      if (!result.ok) {
        setHandleError(result.message);
        return;
      }
      setFormError(null);
      setHandleError(null);
      setPhase('intake');
    } finally {
      setBusy(false);
    }
  }

  async function onHandleBlur() {
    const snapshot = normalizeHandle(handle);
    if (!snapshot) return;
    const result = await checkHandleAvailable(snapshot);
    if (normalizeHandle(handle) !== snapshot) return;
    if (!result.ok) setHandleError(result.message);
    else setHandleError(null);
  }

  function selectChip(field: CoreIntakeField, value: string) {
    switch (field) {
      case 'talk_style':
        setTalkStyle(value as TalkStyle);
        break;
      case 'show_up':
        setShowUp(value);
        break;
      case 'knocks_you_off': {
        const chip = value as KnocksChip;
        setKnocksYouOff((prev) =>
          prev.includes(chip) ? prev.filter((item) => item !== chip) : [...prev, chip],
        );
        break;
      }
      case 'morning_cue':
        setMorningCue(value);
        break;
      case 'evening_wind_down':
        setEveningWindDown(value);
        break;
      case 'energy_pattern':
        setEnergyPattern(value as EnergyPattern);
        break;
      case 'recovery_style':
        setRecoveryStyle(value as RecoveryStyle);
        break;
      case 'support_style':
        setSupportStyle(value as SupportStyle);
        break;
      case 'current_focus':
        setCurrentFocus(value as CurrentFocus);
        break;
    }
  }

  function selectedValues(field: CoreIntakeField): string[] {
    switch (field) {
      case 'talk_style':
        return talkStyle ? [talkStyle] : [];
      case 'show_up':
        return showUp ? [showUp] : [];
      case 'knocks_you_off':
        return knocksYouOff;
      case 'morning_cue':
        return morningCue ? [morningCue] : [];
      case 'evening_wind_down':
        return eveningWindDown ? [eveningWindDown] : [];
      case 'energy_pattern':
        return energyPattern ? [energyPattern] : [];
      case 'recovery_style':
        return recoveryStyle ? [recoveryStyle] : [];
      case 'support_style':
        return supportStyle ? [supportStyle] : [];
      case 'current_focus':
        return currentFocus ? [currentFocus] : [];
    }
  }

  async function submit() {
    if (
      !talkStyle ||
      !showUp ||
      knocksYouOff.length === 0 ||
      !morningCue ||
      !eveningWindDown ||
      !energyPattern ||
      !recoveryStyle ||
      !supportStyle ||
      !currentFocus
    ) {
      setFormError('Pick one to keep going.');
      return;
    }

    const parsedBornOn = bornOnFromParts(birthYear, birthMonth, birthDay);
    if (!parsedBornOn.ok) {
      setPhase('account');
      setAgeError(parsedBornOn.message);
      return;
    }

    setFormError(null);
    setHandleError(null);
    setAgeError(null);
    if (busy) return;
    setBusy(true);
    console.log('[onboarding] submit start');

    try {
      const created = await withTimeout(
        createMe({
          name: name.trim(),
          handle: normalizeHandle(handle),
          show_up: showUp,
          talk_style: talkStyle,
          knocks_you_off: joinKnocks(knocksYouOff),
          morning_cue: morningCue,
          evening_wind_down: eveningWindDown,
          energy_pattern: energyPattern,
          recovery_style: recoveryStyle,
          support_style: supportStyle,
          current_focus: currentFocus,
          timezone,
          invite_code: inviteCode,
          born_on: parsedBornOn.bornOn,
          city: slugifyCity(city) ?? DEFAULT_AROUND_CITY.slug,
        }),
        15000,
        'createMe',
      );
      console.log('[onboarding] createMe succeeded');
      setCreatedUserId(created.id);
      setMeRow(created);
      setPhase('optional-gate');
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string; hint?: string };
      console.log('[onboarding] createMe raw error:', JSON.stringify(e));
      console.log('[onboarding] message:', e.message, '| code:', e.code, '| details:', e.details, '| hint:', e.hint);
      const message = errorMessageForHandle(err);
      if (message.startsWith('That handle')) {
        setPhase('account');
        setHandleError(message);
      } else if (message === UNDER_16_MESSAGE || message.startsWith('When were you born') || message.includes('real date')) {
        setPhase('account');
        setAgeError(message);
      } else {
        setFormError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function goHome() {
    if (busy) return;
    setBusy(true);
    try {
      await withTimeout(refresh(), 15000, 'refresh');
    } catch (err) {
      console.log('[onboarding] refresh error:', err);
      setFormError('Saved. Open the app again if Home does not show yet.');
    } finally {
      setBusy(false);
    }
  }

  async function persistOptionalThen(next: 'advance' | 'home') {
    if (!createdUserId || busy) return;
    const write = writeForOptionalScreen({
      screen: optionalIndex as OptionalScreen,
      typeCode,
      sliderValues,
      closeId,
      closeSecondId,
      disagreeId,
    });
    setBusy(true);
    setFormError(null);
    try {
      if (write) {
        const updated = await withTimeout(
          updateTraits(createdUserId, write.incoming, write.source, write.allowed),
          15000,
          'updateTraits',
        );
        setMeRow(updated);
      }
      if (next === 'home' || optionalIndex >= OPTIONAL_INTAKE_TOTAL - 1) {
        setPhase('sweep');
        return;
      }
      setOptionalIndex((i) => i + 1);
    } catch (err) {
      console.log('[onboarding] updateTraits error:', err);
      setFormError('Couldn\u2019t save that extra bit. Skip or try again.');
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
            {phase === 'account' ? (
              <AccountStep
                theme={theme}
                signupMode={signupMode}
                inviteCode={inviteCode}
                setInviteCode={setInviteCode}
                birthYear={birthYear}
                setBirthYear={setBirthYear}
                birthMonth={birthMonth}
                setBirthMonth={setBirthMonth}
                birthDay={birthDay}
                setBirthDay={setBirthDay}
                name={name}
                setName={setName}
                handle={handle}
                setHandle={(text) => {
                  setHandle(normalizeHandle(text));
                  setHandleError(null);
                }}
                handleError={handleError}
                ageError={ageError}
                setAgeError={setAgeError}
                city={city}
                setCity={setCity}
                busy={busy}
                signingOut={signingOut}
                onSignOut={handleSignOut}
                formError={formError}
                onHandleBlur={() => {
                  void onHandleBlur();
                }}
                onContinue={() => {
                  void continueFromAccount();
                }}
              />
            ) : phase === 'intake' ? (
              <CoreIntakeSweep
                selectedFor={selectedValues}
                onSelect={(field, value) => {
                  setFormError(null);
                  selectChip(field, value);
                }}
                busy={busy}
                formError={formError}
                onSubmit={() => void submit()}
                onBack={() => {
                  setFormError(null);
                  setPhase('account');
                }}
              />
            ) : phase === 'optional-gate' ? (
              <OptionalGate
                busy={busy}
                onSkip={() => setPhase('sweep')}
                onAdd={() => {
                  setFormError(null);
                  setOptionalIndex(0);
                  setPhase('optional');
                }}
              />
            ) : phase === 'optional' ? (
              <>
                <OptionalStep
                  screen={optionalIndex as OptionalScreen}
                  busy={busy}
                  typeCode={typeCode}
                  sliderValues={sliderValues}
                  closeId={optionalIndex === 7 ? closeSecondId : closeId}
                  disagreeId={disagreeId}
                  onType={setTypeCode}
                  onSlider={(axis, value) => {
                    setSliderValues((prev) => ({ ...prev, [axis]: value }));
                  }}
                  onClose={optionalIndex === 7 ? setCloseSecondId : setCloseId}
                  onDisagree={setDisagreeId}
                  onBack={() => {
                    setFormError(null);
                    if (optionalIndex === 0) {
                      setPhase('optional-gate');
                      return;
                    }
                    setOptionalIndex((i) => i - 1);
                  }}
                  onSkipThis={() => {
                    if (optionalIndex >= OPTIONAL_INTAKE_TOTAL - 1) {
                      setPhase('sweep');
                      return;
                    }
                    setOptionalIndex((i) => i + 1);
                  }}
                  onSkipRest={() => setPhase('sweep')}
                  onContinue={() => void persistOptionalThen('advance')}
                />
                {formError ? (
                  <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
                    {formError}
                  </ThemedText>
                ) : null}
              </>
            ) : phase === 'sweep' && meRow ? (
              <IntakeSweep
                me={meRow}
                onUpdated={async () => {
                  if (!createdUserId) return;
                  const next = await fetchMe(createdUserId);
                  if (next) setMeRow(next);
                }}
                onDone={() => void goHome()}
              />
            ) : phase === 'sweep' ? (
              <Pressable onPress={() => void goHome()}>
                <ThemedText type="smallBold">Continue</ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function AccountStep({
  theme,
  signupMode,
  inviteCode,
  setInviteCode,
  birthYear,
  setBirthYear,
  birthMonth,
  setBirthMonth,
  birthDay,
  setBirthDay,
  name,
  setName,
  handle,
  setHandle,
  handleError,
  ageError,
  setAgeError,
  city,
  setCity,
  busy,
  signingOut,
  onSignOut,
  formError,
  onHandleBlur,
  onContinue,
}: {
  theme: { text: string; textSecondary: string; backgroundSelected: string };
  signupMode: SignupMode;
  inviteCode: string;
  setInviteCode: (value: string) => void;
  birthYear: string;
  setBirthYear: (value: string) => void;
  birthMonth: string;
  setBirthMonth: (value: string) => void;
  birthDay: string;
  setBirthDay: (value: string) => void;
  name: string;
  setName: (value: string) => void;
  handle: string;
  setHandle: (value: string) => void;
  handleError: string | null;
  ageError: string | null;
  setAgeError: (value: string | null) => void;
  city: string;
  setCity: (value: string) => void;
  busy: boolean;
  signingOut: boolean;
  onSignOut: () => void;
  formError: string | null;
  onHandleBlur: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <ThemedText type="subtitle">Introduce yourself</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        A few facts first, then nine taps so ATO knows how to talk to you.
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
        onPress={onSignOut}
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
        label="When were you born?"
        required
        error={ageError}
        hint="Day, month, and year. ATO is for people 16 and older.">
        <BornOnFields
          year={birthYear}
          month={birthMonth}
          day={birthDay}
          onYearChange={(text) => {
            setBirthYear(text);
            setAgeError(null);
          }}
          onMonthChange={(text) => {
            setBirthMonth(text);
            setAgeError(null);
          }}
          onDayChange={(text) => {
            setBirthDay(text);
            setAgeError(null);
          }}
          editable={!busy}
        />
      </Field>

      <Field label="What should we call you?" required>
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
        label="Unique @handle"
        required
        error={handleError}
        hint="Letters and numbers only. Reserved: ato, sage, admin, support, you, astrollogs.">
        <View style={styles.handleRow}>
          <TextInput
            value={handle}
            onChangeText={setHandle}
            onBlur={onHandleBlur}
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

      <Field
        label="What city do you go out in?"
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
        onPress={onContinue}
        disabled={busy}
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: '#3c87f7' },
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.submitText}>
          Continue
        </ThemedText>
      </Pressable>
    </>
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

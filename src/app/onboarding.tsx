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
import {
  CORE_INTAKE_QUESTIONS,
  CORE_INTAKE_TOTAL,
  joinKnocks,
  type CoreIntakeField,
  type CurrentFocus,
  type EnergyPattern,
  type IntakeChip,
  type KnocksChip,
  type RecoveryStyle,
  type SupportStyle,
  intakeProgressLabel,
} from '@/lib/intake';
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

type Phase = 'account' | 'intake';

export default function OnboardingScreen() {
  const theme = useTheme();
  const { refresh } = useMeContext();

  const [phase, setPhase] = useState<Phase>('account');
  const [intakeIndex, setIntakeIndex] = useState(0);

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

  function normalizeHandle(raw: string): string {
    return raw.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
  }

  function validateAccount(): boolean {
    const trimmedName = name.trim();
    const normalizedHandle = normalizeHandle(handle);

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
    if (!normalizedHandle) {
      setHandleError('Pick a handle.');
      return false;
    }
    if (RESERVED_HANDLES.includes(normalizedHandle)) {
      setHandleError('That handle is reserved.');
      return false;
    }

    setFormError(null);
    setHandleError(null);
    setAgeError(null);
    return true;
  }

  function intakeAnswered(field: CoreIntakeField): boolean {
    switch (field) {
      case 'talk_style':
        return talkStyle != null;
      case 'show_up':
        return !!showUp;
      case 'knocks_you_off':
        return knocksYouOff.length > 0;
      case 'morning_cue':
        return !!morningCue;
      case 'evening_wind_down':
        return !!eveningWindDown;
      case 'energy_pattern':
        return energyPattern != null;
      case 'recovery_style':
        return recoveryStyle != null;
      case 'support_style':
        return supportStyle != null;
      case 'current_focus':
        return currentFocus != null;
    }
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

  function goNextIntake() {
    const question = CORE_INTAKE_QUESTIONS[intakeIndex];
    if (!question || !intakeAnswered(question.field)) {
      setFormError('Pick one to keep going.');
      return;
    }
    setFormError(null);
    if (intakeIndex < CORE_INTAKE_TOTAL - 1) {
      setIntakeIndex((i) => i + 1);
      return;
    }
    void submit();
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
      await withTimeout(
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
      await withTimeout(refresh(), 15000, 'refresh');
      console.log('[onboarding] refresh done');
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

  async function handleSignOut() {
    if (signingOut || busy) return;
    setSigningOut(true);
    await clearLocalSession();
    setSigningOut(false);
  }

  const question = CORE_INTAKE_QUESTIONS[intakeIndex];

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
                onContinue={() => {
                  if (!validateAccount()) return;
                  setPhase('intake');
                  setIntakeIndex(0);
                }}
              />
            ) : question ? (
              <IntakeStep
                question={question}
                selected={selectedValues(question.field)}
                onSelect={(value) => {
                  setFormError(null);
                  selectChip(question.field, value);
                }}
                formError={formError}
                busy={busy}
                onBack={() => {
                  setFormError(null);
                  if (intakeIndex === 0) {
                    setPhase('account');
                    return;
                  }
                  setIntakeIndex((i) => i - 1);
                }}
                onContinue={goNextIntake}
              />
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

function IntakeStep({
  question,
  selected,
  onSelect,
  formError,
  busy,
  onBack,
  onContinue,
}: {
  question: (typeof CORE_INTAKE_QUESTIONS)[number];
  selected: string[];
  onSelect: (value: string) => void;
  formError: string | null;
  busy: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const last = question.n === CORE_INTAKE_TOTAL;
  const canContinue = selected.length > 0;

  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progress}>
        {intakeProgressLabel(question.n)}
      </ThemedText>
      <ThemedText type="subtitle">{question.prompt}</ThemedText>

      <ChipGroup
        chips={question.chips}
        selected={selected}
        multi={question.multi}
        disabled={busy}
        onSelect={onSelect}
      />

      {formError ? (
        <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
          {formError}
        </ThemedText>
      ) : null}

      <View style={styles.navRow}>
        <Pressable
          onPress={onBack}
          disabled={busy}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed, busy && styles.disabled]}>
          <ThemedText type="smallBold">Back</ThemedText>
        </Pressable>
        <Pressable
          onPress={onContinue}
          disabled={busy || !canContinue}
          style={({ pressed }) => [
            styles.submitButton,
            styles.nextButton,
            { backgroundColor: '#3c87f7' },
            pressed && styles.pressed,
            (busy || !canContinue) && styles.disabled,
          ]}>
          <ThemedText type="smallBold" style={styles.submitText}>
            {busy ? 'Saving…' : last ? 'Save' : 'Continue'}
          </ThemedText>
        </Pressable>
      </View>
    </>
  );
}

function ChipGroup({
  chips,
  selected,
  multi,
  disabled,
  onSelect,
}: {
  chips: IntakeChip[];
  selected: string[];
  multi?: boolean;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.chipWrap}>
      {chips.map((chip) => {
        const on = selected.includes(chip.value);
        return (
          <Pressable
            key={chip.value}
            onPress={() => onSelect(chip.value)}
            disabled={disabled}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on, selected: on }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                borderColor: on ? theme.text : theme.backgroundElement,
              },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}>
            <ThemedText type="small" themeColor={on ? 'text' : 'textSecondary'}>
              {chip.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
  progress: {
    letterSpacing: 0.4,
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
  hint: {
    lineHeight: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  backButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  submitButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  nextButton: {
    flex: 1,
    marginTop: 0,
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

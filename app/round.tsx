import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { LIMITS } from '../src/config';
import { fuseProgress, holderLabel } from '../src/engine';
import { useGame } from '../src/store/game';
import { AppText, Button, Card, FuseBar, IconButton, palette, PhraseText, Screen, spacing } from '../src/ui';

const dark = palette.dark;

export default function Round() {
  // PRD: keep the screen awake during rounds.
  useKeepAwake('blurt-round', { suppressDeactivateWarnings: true });

  const game = useGame((s) => s.game);
  const actions = useGame(
    useShallow((s) => ({
      gotIt: s.gotIt,
      skip: s.skip,
      pause: s.pause,
      resume: s.resume,
      endRoundNoScore: s.endRoundNoScore,
      quitGame: s.quitGame,
    })),
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const pausedByMenu = useRef(false);
  const lastAdvance = useRef(0);
  const [progress, setProgress] = useState(0);

  const showFuse = game?.settings.showFuse ?? false;
  const paused = game?.phase === 'paused';

  // Chill mode only: poll fuse progress for the visible FuseBar. Hidden mode never reads time.
  useEffect(() => {
    if (!showFuse) return;
    const id = setInterval(() => {
      const g = useGame.getState().game;
      if (g) setProgress(fuseProgress(g, Date.now()));
    }, 200);
    return () => clearInterval(id);
  }, [showFuse]);

  // Backgrounding the app (or a phone call) pauses the fuse and hides the phrase.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      const { game: g, pause } = useGame.getState();
      if (g?.phase === 'playing') pause();
    });
    return () => sub.remove();
  }, []);

  if (!game) return null; // The root layout routes home when the game ends.

  const team = game.settings.teams[game.holderTeamIndex];
  const holder = holderLabel(game);
  const skipsAllowed = game.settings.skipsPerTurn !== 0;
  const unlimitedSkips = game.skipsLeft === null;
  const outOfSkips = !unlimitedSkips && (game.skipsLeft ?? 0) <= 0;

  /** Button-level 300 ms guard so a frantic double tap never advances twice (the engine also guards). */
  const advance = (fn: () => void) => {
    const now = Date.now();
    if (now - lastAdvance.current < LIMITS.advanceDebounceMs) return;
    lastAdvance.current = now;
    fn();
  };

  const openMenu = () => {
    if (useGame.getState().game?.phase === 'playing') {
      actions.pause();
      pausedByMenu.current = true;
    }
    setConfirmQuit(false);
    setMenuOpen(true);
  };
  const closeMenu = () => {
    setMenuOpen(false);
    if (pausedByMenu.current) {
      pausedByMenu.current = false;
      actions.resume();
    }
  };
  const endRound = () => {
    pausedByMenu.current = false;
    setMenuOpen(false);
    actions.endRoundNoScore();
  };
  const quit = () => {
    pausedByMenu.current = false;
    setMenuOpen(false);
    actions.quitGame();
  };

  return (
    <Screen scheme="dark" tint={team?.color} testID="round-screen">
      <StatusBar style="light" />

      {/* Top bar: who holds the phone + pause (long-press = host menu). */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" color={dark.text} accessibilityRole="header" testID="round-holder">
            {holder} is up
          </AppText>
          <AppText variant="caption" color={dark.text}>
            {holder !== team?.name ? `${team?.name} · ` : ''}Round {game.round}
          </AppText>
        </View>
        <IconButton
          icon={paused ? '▶️' : '⏸️'}
          size="lg"
          accessibilityLabel={paused ? 'Resume. Long press for host menu' : 'Pause. Long press for host menu'}
          onPress={paused ? actions.resume : actions.pause}
          onLongPress={openMenu}
          delayLongPress={600}
          testID="round-pause"
        />
      </View>

      {showFuse ? (
        <View style={{ paddingTop: spacing.sm }} accessibilityLabel="Fuse" testID="round-fuse">
          <FuseBar progress={progress} />
        </View>
      ) : null}

      {/* The phrase, huge and centered. Hidden while paused. */}
      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: spacing.lg }}>
        <PhraseText text={game.currentPhrase?.text ?? ''} color={dark.text} hidden={paused} testID="round-phrase" />
        {paused ? (
          <AppText variant="body" align="center" color={dark.text} style={{ marginTop: spacing.md }}>
            Paused. The fuse is frozen.
          </AppText>
        ) : null}
      </View>

      {/* Thumb zone */}
      {paused ? (
        <Button
          label="Resume"
          icon="▶️"
          size="xl"
          variant="primary"
          fullWidth
          onPress={actions.resume}
          testID="round-resume"
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {skipsAllowed ? (
            <View style={{ alignItems: 'center' }}>
              <Button
                label={unlimitedSkips ? 'Skip' : `Skip (${game.skipsLeft} left)`}
                size="sm"
                variant="ghost"
                disabled={outOfSkips}
                onPress={() => advance(actions.skip)}
                accessibilityLabel={
                  unlimitedSkips
                    ? 'Skip phrase'
                    : `Skip phrase, ${game.skipsLeft} ${game.skipsLeft === 1 ? 'skip' : 'skips'} left`
                }
                testID="round-skip"
              />
            </View>
          ) : null}
          <Button
            label="Got it!"
            icon="✅"
            size="xl"
            variant="primary"
            fullWidth
            onPress={() => advance(actions.gotIt)}
            accessibilityHint="Then pass the phone to the next player"
            testID="round-got-it"
          />
        </View>
      )}

      {/* Host-only menu (long-press the pause button). */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg }}
          onPress={closeMenu}
          accessibilityLabel="Close host menu"
        >
          <Pressable onPress={() => {}} accessible={false}>
            <Card style={{ gap: spacing.sm }} testID="round-host-menu">
              <AppText variant="title" accessibilityRole="header">
                Host menu
              </AppText>
              {confirmQuit ? (
                <>
                  <AppText variant="body">Quit this game? Scores will be lost.</AppText>
                  <Button
                    label="Yes, quit game"
                    variant="danger"
                    fullWidth
                    onPress={quit}
                    testID="round-quit-confirm"
                  />
                  <Button label="Keep playing" variant="secondary" fullWidth onPress={() => setConfirmQuit(false)} />
                </>
              ) : (
                <>
                  <AppText variant="body">The round is paused.</AppText>
                  <Button
                    label="End round (no score)"
                    icon="🛑"
                    variant="secondary"
                    fullWidth
                    onPress={endRound}
                    accessibilityHint="Ends this round early. Nobody scores."
                    testID="round-end-no-score"
                  />
                  <Button
                    label="Quit game"
                    icon="🚪"
                    variant="danger"
                    fullWidth
                    onPress={() => setConfirmQuit(true)}
                    testID="round-quit"
                  />
                  <Button label="Cancel" variant="ghost" fullWidth onPress={closeMenu} testID="round-menu-cancel" />
                </>
              )}
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

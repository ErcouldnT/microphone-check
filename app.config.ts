import type { ConfigContext, ExpoConfig } from 'expo/config';
import { ConfigPlugin, withAndroidStyles } from 'expo/config-plugins';

const DIALOG_STYLE = 'Theme.App.PickerDialog';

/**
 * Forces the native date/time picker dialogs to render dark.
 *
 * The app draws itself dark unconditionally, but the generated Android theme is
 * DayNight, so on a device whose system theme is light the pickers came up
 * light-on-white against the app. Pointing the picker dialog themes at an
 * explicitly dark style makes them match whatever the system is set to.
 */
const withDarkPickerDialogs: ConfigPlugin = expoConfig =>
  withAndroidStyles(expoConfig, modConfig => {
    const styles = modConfig.modResults;

    // Theme.AppCompat (not DayNight) is the dark variant.
    if (!styles.resources.style?.some(style => style.$.name === DIALOG_STYLE)) {
      styles.resources.style = [
        ...(styles.resources.style ?? []),
        {
          $: { name: DIALOG_STYLE, parent: 'Theme.AppCompat.Dialog.Alert' },
          item: [
            // Both the AppCompat and framework accents are set: the dialog's
            // header band and selection disc read from the framework one.
            { $: { name: 'colorAccent' }, _: '@color/colorPrimary' },
            { $: { name: 'android:colorAccent' }, _: '@color/colorPrimary' },
            { $: { name: 'colorPrimary' }, _: '@color/colorPrimary' },
            { $: { name: 'android:colorControlActivated' }, _: '@color/colorPrimary' },
            { $: { name: 'android:windowBackground' }, _: '#0B0B10' },
            { $: { name: 'android:textColorPrimary' }, _: '#FFFFFF' },
            { $: { name: 'android:textColorSecondary' }, _: '#8A8A94' },
          ],
        },
      ];
    }

    // Edit the generated AppTheme in place. Using the config-plugin helper here
    // appends a second AppTheme with a different parent, which fails the
    // resource merger with "Found item Style/AppTheme more than one time".
    const appTheme = styles.resources.style?.find(style => style.$.name === 'AppTheme');
    if (appTheme) {
      // The UI is drawn dark unconditionally, so the base theme should be too.
      // This also decides the window background shown between the splash
      // handing off and the first React frame, which was a bare flash before.
      appTheme.$.parent = 'Theme.AppCompat.NoActionBar';
      appTheme.item = appTheme.item ?? [];

      if (!appTheme.item.some(entry => entry.$.name === 'android:windowBackground')) {
        appTheme.item.push({
          $: { name: 'android:windowBackground' },
          _: '@color/splashscreen_background',
        });
      }

      for (const attribute of [
        'android:datePickerDialogTheme',
        'android:timePickerDialogTheme',
        'android:alertDialogTheme',
      ]) {
        if (!appTheme.item.some(entry => entry.$.name === attribute)) {
          appTheme.item.push({ $: { name: attribute }, _: `@style/${DIALOG_STYLE}` });
        }
      }
    }

    return modConfig;
  });

/** app.json holds the static configuration; this layer adds code-only plugins. */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [...(config.plugins ?? []), withDarkPickerDialogs],
});

import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import type { DynamicFormProps } from '@tramites/form-contracts';
import { remoteOrigin } from '../../../shared/config/public-env';

type RemoteModule = {
  DynamicForm?: React.ComponentType<DynamicFormProps>;
  default?: React.ComponentType<DynamicFormProps>;
};

type FederationInstance = {
  loadRemote: <T = RemoteModule>(id: string) => Promise<T>;
};

const reactVersion = '19.3.0-canary-cbb046ab-20260731';

export async function loadRemoteForm(): Promise<React.ComponentType<DynamicFormProps>> {
  const { createInstance } = await import('@module-federation/enhanced/runtime');
  const mf = createInstance({
    name: 'web_host',
    remotes: [{ name: 'form_remote', alias: 'form_remote', entry: `${remoteOrigin}/mf-manifest.json` }],
    shared: {
      react: { version: reactVersion, scope: 'default', lib: () => React, shareConfig: { singleton: true, requiredVersion: reactVersion } },
      'react-dom': { version: reactVersion, scope: 'default', lib: () => ReactDOM, shareConfig: { singleton: true, requiredVersion: reactVersion } },
      'react/jsx-runtime': { version: reactVersion, scope: 'default', lib: () => ReactJSXRuntime, shareConfig: { singleton: true, requiredVersion: reactVersion } },
      'react-dom/client': { version: reactVersion, scope: 'default', lib: () => ReactDOMClient, shareConfig: { singleton: true, requiredVersion: reactVersion } },
    },
  }) as FederationInstance;
  const module = await mf.loadRemote<RemoteModule>('form_remote/DynamicForm');
  const remoteComponent = module.DynamicForm ?? module.default;
  if (!remoteComponent) throw new Error('El remote no expuso DynamicForm');
  return remoteComponent;
}

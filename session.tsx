import React, { Context, ReactNode, useState, createContext, useEffect, useMemo, useRef } from 'react';
import { EventEmitter } from 'events';
import { isNull } from 'lodash';
import Debug from 'debug';

import { IStoreContext, IUseStore, defaultContext, useStore } from './store';

const debug = Debug('store:session');

const sessionStorageEvent = new EventEmitter();

export const SessionContext = createContext(defaultContext);

const stringify = (item) => {
  if (typeof(item) === 'undefined' || isNull(item)) return '';
  return JSON.stringify(item);
};

export const SessionStoreProvider = ({
  context = SessionContext,
  children,
}: {
  context?: Context<IStoreContext>;
  children?: ReactNode;
}) => {
  const [useStore] = useState(() => {
    return function useStore<T extends any>(
      key: string,
      defaultValue: T,
    ): ReturnType<IUseStore<T>> {
      const memoDefaultValue = useMemo(() => defaultValue, []);
      const [value, _setValue] = useState<string>(typeof(sessionStorage) === 'undefined' ? stringify(memoDefaultValue) : (sessionStorage.hasOwnProperty(key) ? sessionStorage.getItem(key) : stringify(memoDefaultValue)));

      const stateRef = useRef<any>();
      stateRef.current = value;

      useEffect(
        () => {
          const hasOwnProperty = sessionStorage.hasOwnProperty(key);
          debug('init', { key, defaultValue: memoDefaultValue, hasOwnProperty });
          if (!hasOwnProperty) {
            const json = stringify(memoDefaultValue);
            sessionStorage.setItem(key, json);
            _setValue(json);
          }
          const fn = (value) => {
            const item = sessionStorage.getItem(key);
            if (typeof(item) === 'undefined' || isNull(item)) _setValue(stringify(memoDefaultValue));
            else _setValue(value);
          };
          sessionStorageEvent.on(key, fn);
          return () => {
            sessionStorageEvent.off(key, fn);
          };
        },
        [],
      );
      const [setValue] = useState(() => (value) => {
        debug('setValue', { key, defaultValue: memoDefaultValue, value });
        let current;
        try {
          current = JSON.parse(stateRef.current);
        } catch(error) {
          current = undefined;
        }
        const _value = typeof(value) === 'function' ? value(current) : value;
        const json = stringify(_value);
        sessionStorage.setItem(key, json);
        _setValue(json);
        sessionStorageEvent.emit(key, json);
      });
      const [unsetValue] = useState(() => () => {
        debug('unsetValue', { key, defaultValue: memoDefaultValue });
        sessionStorage.removeItem(key);
        sessionStorageEvent.emit(key, memoDefaultValue);
      });
      const _value = useMemo(() => {
        try {
          return JSON.parse(value);
        } catch(error) {
          return undefined;
        }
      }, [value]);
      return [_value, setValue, unsetValue, false];
    };
  });

  return <context.Provider value={{ useStore }}>
    {children}
  </context.Provider>;
};

/**
 * A custom React hook to use the session store
 * 
 * @example
 * ```
 * // Wrap your component with SessionStoreProvider to use useSessionStore hook.
 * <SessionStoreProvider>
 *   <MyComponent />
 * </SessionStoreProvider>
 * 
 * function MyComponent() {
 *   const [value, setValue, unsetValue, isLoading] = useSessionStore('key', 'defaultValue');
 *   return <div>{value}</div>;
 * }
 * ```
 */
export function useSessionStore<T extends any>(key: string, defaultValue: T, context = SessionContext) {
  return useStore(key, defaultValue, context);
}
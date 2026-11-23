import { useState } from 'react';
import { Badge, initials } from '@/components/Badge';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { filterPeople, type Person, toggleId } from '@/lib/spaces/people';

/** Above this many people a search field appears. */
const SEARCH_FROM = 8;

interface Props {
  people: Person[] | null;
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Already in the space: not offered. */
  exclude?: ReadonlySet<string>;
  title?: string;
  footer?: string;
}

/**
 * Tick the people to add (inset grouped list, a round tick per row). Used when
 * creating a space, in Miembros ("Añadir miembros") and in the admin panel.
 */
export function PeoplePicker({ people, selected, onChange, exclude, title = 'Personas', footer }: Props) {
  const [query, setQuery] = useState('');
  if (!people) return <LoadingBar label="Cargando personas…" />;
  const available = filterPeople(people, '', exclude);
  const shown = filterPeople(people, query, exclude);
  if (available.length === 0) {
    return (
      <Text tone="secondary">
        No hay más personas para añadir. El administrador crea las cuentas nuevas.
      </Text>
    );
  }
  return (
    <>
      {available.length > SEARCH_FROM && (
        <TextField label="Buscar persona" value={query} onChangeText={setQuery} placeholder="Nombre de usuario" />
      )}
      <Section title={title} footer={footer}>
        {shown.map((p) => (
          <ListRow
            key={p.user_id}
            label={p.username}
            checked={selected.has(p.user_id)}
            onPress={() => onChange(toggleId(selected, p.user_id))}
            leading={<Badge text={initials(p.username)} round tone="neutral" />}
          >
            <Text variant="headline" numberOfLines={1}>
              {p.username}
            </Text>
          </ListRow>
        ))}
      </Section>
      {shown.length === 0 && (
        <Text tone="secondary">
          Nadie coincide con «{query}».
        </Text>
      )}
    </>
  );
}

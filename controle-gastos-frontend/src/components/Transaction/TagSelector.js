import React, { useMemo } from 'react';
import Select from 'react-select';
import IconRenderer from '../shared/IconRenderer';

const selectStyles = {
  control: (provided) => ({
    ...provided,
    border: '1px solid rgba(44, 62, 80, 0.2)',
    borderRadius: 'var(--borda-radius)',
    minHeight: '38px',
    boxShadow: 'none',
    '&:hover': { border: '1px solid var(--cor-primaria)' }
  }),
  option: (provided, state) => ({
    ...provided,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: state.data.cor || provided.color,
    backgroundColor: state.isFocused ? '#f0f0f0' : 'white',
    '&:hover': { backgroundColor: '#f0f0f0' }
  }),
  multiValue: (provided, state) => ({
    ...provided,
    backgroundColor: state.data.cor + '20',
    borderRadius: '12px',
    padding: '2px'
  }),
  multiValueLabel: (provided, state) => ({
    ...provided,
    color: state.data.cor,
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 999
  }),
  menuList: (provided) => ({
    ...provided,
    maxHeight: '200px'
  })
};

const formatOptionLabel = ({ label, cor, icone }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <IconRenderer nome={icone || 'tag'} size={20} cor={cor} />
    <span>{label}</span>
  </div>
);

const TagSelector = React.memo(({ categorias, allTags, paymentTags, onTagsChange, tabIndex = 50 }) => {
  const optionsByCategory = useMemo(() => {
    const map = {};
    categorias.forEach(cat => {
      map[cat._id] = allTags
        .filter(t => t.categoria === cat._id)
        .map(t => ({ value: t._id, label: t.nome, cor: t.cor, icone: t.icone }));
    });
    return map;
  }, [categorias, allTags]);

  return (
    <div className="tags-section">
      <h4>Tags para Pagamento</h4>
      {categorias.map((cat) => {
        const options = optionsByCategory[cat._id] || [];
        const rawValues = (paymentTags && paymentTags[cat._id]) || [];
        const selectedValues = rawValues
          .map(tagId => {
            const tag = allTags.find(t => t._id === tagId);
            return tag ? { value: tag._id, label: tag.nome, cor: tag.cor, icone: tag.icone } : null;
          })
          .filter(Boolean);

        return (
          <div key={cat._id} className="tag-category-group">
            <label>
              <IconRenderer nome={cat.icone || 'folder'} size={20} cor={cat.cor || '#000'} />
              {cat.nome}
            </label>
            <Select
              isMulti
              options={options}
              value={selectedValues}
              onChange={(selected) => {
                const newPaymentTags = { ...paymentTags };
                newPaymentTags[cat._id] = selected ? selected.map(s => s.value) : [];
                onTagsChange(newPaymentTags);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                }
              }}
              tabIndex={tabIndex}
              blurInputOnSelect={false}
              closeMenuOnSelect={false}
              tabSelectsValue={false}
              openMenuOnFocus={false}
              backspaceRemovesValue={true}
              components={{
                DropdownIndicator: null,
                IndicatorSeparator: null
              }}
              styles={selectStyles}
              formatOptionLabel={formatOptionLabel}
              placeholder="Selecione as tags..."
              className="tag-select"
              classNamePrefix="tag-select"
              isClearable={false}
              isSearchable={true}
              menuPlacement="auto"
              noOptionsMessage={() => "Nenhuma tag encontrada"}
              loadingMessage={() => "Carregando..."}
            />
          </div>
        );
      })}
    </div>
  );
});

export default TagSelector;

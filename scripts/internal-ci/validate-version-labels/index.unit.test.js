const {
  getLabelArray,
  getVersionLabelArray,
  getInvalidVersionLabels,
  getComponentVersionLabels,
  expandComponentVersionLabel,
  parseComponentVersionLabels,
  getDuplicateComponents,
  getReleasedVersions,
  getInvalidComponents,
  hasChangelogEntry,
  getMissingChangelogs,
  validate,
  versionLabelPrefix,
  untrackedLabel,
} = require('.');

describe('getLabelArray', () => {
  it('should parse raw newline separated labels into an array', () => {
    const rawLabels = 'label1\nlabel2\nlabel3';
    const labels = getLabelArray(rawLabels);
    expect(labels).toEqual(['label1', 'label2', 'label3']);
  });
});

describe('getVersionLabelArray', () => {
  it('should filter version labels from the label array', () => {
    const labels = [
      `${versionLabelPrefix}`,
      `${untrackedLabel}`,
      'bugfix',
      `${versionLabelPrefix}abc`,
      'enhancement',
      'version',
      'version:actions/old-format/1.0.0',
    ];
    const versionLabels = getVersionLabelArray(labels);
    expect(versionLabels).toEqual([
      `${versionLabelPrefix}`,
      `${untrackedLabel}`,
      `${versionLabelPrefix}abc`,
    ]);
  });
});

const versionLabels = [
  `${versionLabelPrefix}`, //incomplete version label
  `${untrackedLabel}`, // valid untracked label
  `${versionLabelPrefix}a/valid-component/1.0.0`, // valid action label
  `${versionLabelPrefix}wf/valid-workflow/2.0.0`, // valid workflow label
  'invalid-label', // completely invalid label
  `${versionLabelPrefix}/1.0.0`, // missing component info
  `${versionLabelPrefix}invalid/component/1.0.0`, // invalid component type alias
  `${versionLabelPrefix}a/invalid-component`, // missing version
  `${versionLabelPrefix}a/invalid-component/1.0`, // not full semver
  `${versionLabelPrefix}a/invalid-component/1.0.0-extra`, // don't support build metadata
  `${versionLabelPrefix}a/invalid-component/v1.0.0`, // has 'v' prefix
];

describe('getInvalidVersionLabels', () => {
  it('should identify invalid version labels', () => {
    const invalidLabels = getInvalidVersionLabels(versionLabels);
    expect(invalidLabels).toEqual([
      `${versionLabelPrefix}`,
      'invalid-label',
      `${versionLabelPrefix}/1.0.0`,
      `${versionLabelPrefix}invalid/component/1.0.0`,
      `${versionLabelPrefix}a/invalid-component`,
      `${versionLabelPrefix}a/invalid-component/1.0`,
      `${versionLabelPrefix}a/invalid-component/1.0.0-extra`,
      `${versionLabelPrefix}a/invalid-component/v1.0.0`,
    ]);
  });
});

describe('getComponentVersionLabels', () => {
  it('should extract valid component version labels', () => {
    const componentLabels = getComponentVersionLabels(versionLabels);
    expect(componentLabels).toEqual([
      `${versionLabelPrefix}a/valid-component/1.0.0`,
      `${versionLabelPrefix}wf/valid-workflow/2.0.0`,
    ]);
  });
});

describe('expandComponentVersionLabel', () => {
  it.each([
    [`${versionLabelPrefix}a/example-action/1.2.3`, 'actions/example-action/1.2.3'],
    [`${versionLabelPrefix}wf/example-workflow/2.3.4`, 'workflows/example-workflow/2.3.4'],
  ])('should expand %s to %s', (label, expectedTag) => {
    expect(expandComponentVersionLabel(label)).toBe(expectedTag);
  });
});

/// It is assumed that component version labels are valid when this function is called
describe('parseComponentVersionLabels', () => {
  it('should parse component version labels into a map', () => {
    const componentLabels = [
      `${versionLabelPrefix}a/component-a/1.2.3`,
      `${versionLabelPrefix}wf/component-b/2.3.4`,
    ];
    const componentVersionMap = parseComponentVersionLabels(componentLabels);
    expect(componentVersionMap).toEqual({
      'actions/component-a': '1.2.3',
      'workflows/component-b': '2.3.4',
    });
  });
});

describe('getDuplicateComponents', () => {
  it('should return components with more than one version label', () => {
    const componentLabels = [
      `${versionLabelPrefix}a/component-a/1.2.3`,
      `${versionLabelPrefix}wf/component-b/2.3.4`,
      `${versionLabelPrefix}a/component-a/1.2.4`,
      `${versionLabelPrefix}wf/component-a/1.0.0`,
    ];
    expect(getDuplicateComponents(componentLabels)).toEqual(['actions/component-a']);
  });

  it('should return an empty array when each component has one label', () => {
    const componentLabels = [
      `${versionLabelPrefix}a/component-a/1.2.3`,
      `${versionLabelPrefix}wf/component-a/1.2.3`,
    ];
    expect(getDuplicateComponents(componentLabels)).toEqual([]);
  });
});

describe('getReleasedVersions', () => {
  const releasedTags = ['actions/component-a/1.0.0', 'workflows/component-b/2.0.0'];

  it('should return component versions that already have a tag', () => {
    const componentVersionMap = {
      'actions/component-a': '1.0.0',
      'workflows/component-b': '2.0.1',
    };
    expect(getReleasedVersions(componentVersionMap, releasedTags)).toEqual([
      'actions/component-a/1.0.0',
    ]);
  });

  it('should not match a tag of the same version for another component type', () => {
    const componentVersionMap = { 'workflows/component-a': '1.0.0' };
    expect(getReleasedVersions(componentVersionMap, releasedTags)).toEqual([]);
  });
});

// It is assumed that path is correctly formatted when this function is called (dir1/dir2)
describe('getInvalidComponents', () => {
  const fs = require('fs');
  let existsSyncMock;
  let lstatSyncMock;

  // Simulate a static directory structure
  const pathTypeMap = {
    '.github/actions/valid-component': 'directory', // valid action directory
    '.github/workflows/valid-workflow.yml': 'file', // valid workflow file
    '.github/actions/not-a-directory': 'file', // invalid action, extensionless file instead of directory
    '.github/workflows/not-a-file': 'directory', // invalid workflow - subdirectory instead of file
    '.github/workflows/not-yaml.txt': 'file', // invalid workflow - wrong file type
    '.github/workflows/directory-workflow.yml': 'directory', // invalid workflow - directory named like a workflow
    '.github/foo/bar.yml': 'file', // invalid type
  };

  beforeAll(() => {
    existsSyncMock = jest
      .spyOn(fs, 'existsSync')
      .mockImplementation(path => Object.prototype.hasOwnProperty.call(pathTypeMap, path));
    lstatSyncMock = jest.spyOn(fs, 'lstatSync').mockImplementation(path => ({
      isDirectory: () => pathTypeMap[path] === 'directory',
      isFile: () => pathTypeMap[path] === 'file',
    }));
  });

  afterAll(() => {
    existsSyncMock.mockRestore();
    lstatSyncMock.mockRestore();
  });

  it('should return an empty array when there are no components', () => {
    const componentVersionMap = {};
    const invalidComponents = getInvalidComponents(componentVersionMap);
    expect(invalidComponents).toEqual([]);
  });

  it('should return paths not starting with actions/ or workflows/', () => {
    const componentVersionMap = {
      'actions/valid-component': '1.0.0',
      'workflows/valid-workflow': '1.0.0',
      'foo/bar': '1.0.0',
    };
    const invalidComponents = getInvalidComponents(componentVersionMap);
    expect(invalidComponents).toEqual(['foo/bar']);
  });

  it('should return paths where the expected path does not exist', () => {
    const componentVersionMap = {
      'actions/nonexistent-component': '1.0.0',
      'workflows/nonexistent-workflow': '1.0.0',
      'actions/valid-component': '1.0.0',
      'workflows/valid-workflow': '1.0.0',
    };
    const invalidComponents = getInvalidComponents(componentVersionMap);
    expect(invalidComponents).toEqual([
      'actions/nonexistent-component',
      'workflows/nonexistent-workflow',
    ]);
  });

  it('should return paths where the expected directory is not a directory', () => {
    const componentVersionMap = {
      'actions/not-a-directory': '1.0.0',
    };
    const invalidComponents = getInvalidComponents(componentVersionMap);
    expect(invalidComponents).toEqual(['actions/not-a-directory']);
  });

  it('should return an empty array when all components are valid', () => {
    const componentVersionMap = {
      'actions/valid-component': '1.0.0',
      'workflows/valid-workflow': '1.0.0',
    };
    const invalidComponents = getInvalidComponents(componentVersionMap);
    expect(invalidComponents).toEqual([]);
  });

  it('should return paths where the expected workflow is not a YAML file', () => {
    const componentVersionMap = {
      'workflows/not-a-file': '1.0.0',
      'workflows/not-yaml': '1.0.0',
    };
    const invalidComponents = getInvalidComponents(componentVersionMap);
    expect(invalidComponents).toEqual(['workflows/not-a-file', 'workflows/not-yaml']);
  });

  it('should return workflows whose .yml path is a directory', () => {
    const componentVersionMap = {
      'workflows/directory-workflow': '1.0.0',
    };
    const invalidComponents = getInvalidComponents(componentVersionMap);
    expect(invalidComponents).toEqual(['workflows/directory-workflow']);
  });
});

describe('hasChangelogEntry', () => {
  it.each([
    ['## 1.0.0\n- Initial release', '1.0.0'],
    ['# Changelog\n\n## 1.0.1\n\n## 1.0.0', '1.0.0'],
    ['## 1.0.0 - Initial Release', '1.0.0'],
    ['## 1.0.0 — Initial Release', '1.0.0'],
    ['## 1.0.0\r\n- Windows line endings', '1.0.0'],
  ])('should find the entry in %j for %s', (content, version) => {
    expect(hasChangelogEntry(content, version)).toBe(true);
  });

  it.each([
    ['## 1.0.10', '1.0.1'],
    ['### 1.0.0', '1.0.0'],
    ['## 11.0.0', '1.0.0'],
    ['## 1x0x0', '1.0.0'],
    ['## v1.0.0', '1.0.0'],
    ['## 1.0.0-beta', '1.0.0'],
    ['Released in ## 1.0.0', '1.0.0'],
  ])('should not find the entry in %j for %s', (content, version) => {
    expect(hasChangelogEntry(content, version)).toBe(false);
  });
});

// It is assumed that path is correctly formatted when this function is called (dir1/dir2)
// It is assumed that the components exist when this function is called
// It is assumed that version is correctly formatted when this function is called (X.Y.Z)
describe('getMissingChangelogs', () => {
  const fs = require('fs');
  let existsSyncMock;
  let readFileSyncMock;

  // Simulate a static file structure
  const fileSet = new Set([
    '.github/actions/component-with-changelog/CHANGELOG.md',
    '.github/actions/component-without-changelog',
    '.github/actions/component-missing-changelog-entry/CHANGELOG.md',
    '.github/workflows/CHANGELOGS/workflow-with-changelog.md',
    '.github/workflows/CHANGELOGS/workflow-missing-changelog-entry.md',
    '.github/workflows/CHANGELOGS/workflow-without-changelog',
    '.github/workflows/wrong_location_CHANGELOG.md',
  ]);
  const fileContentMap = {
    '.github/actions/component-with-changelog/CHANGELOG.md': '## 1.0.0\n- Initial release',
    '.github/actions/component-missing-changelog-entry/CHANGELOG.md': '',
    '.github/workflows/CHANGELOGS/workflow-with-changelog.md': '## 2.0.0\n- Major update',
    '.github/workflows/CHANGELOGS/workflow-missing-changelog-entry.md': '',
    '.github/workflows/wrong_location_CHANGELOG.md': '## 1.0.0\n- Initial release',
  };

  beforeAll(() => {
    existsSyncMock = jest.spyOn(fs, 'existsSync').mockImplementation(path => fileSet.has(path));
    readFileSyncMock = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(path => fileContentMap[path]);
  });

  afterAll(() => {
    existsSyncMock.mockRestore();
    readFileSyncMock.mockRestore();
  });

  it('should return an empty array when there are no components', () => {
    const componentVersionMap = {};
    const missingChangelogs = getMissingChangelogs(componentVersionMap);
    expect(missingChangelogs).toEqual([]);
  });

  it('should identify components missing CHANGELOG.md files or entries', () => {
    const componentVersionMap = {
      'actions/component-with-changelog': '1.0.0',
      'actions/component-without-changelog': '1.0.0',
      'actions/component-missing-changelog-entry': '1.0.0',
      'workflows/workflow-with-changelog': '2.0.0',
      'workflows/workflow-without-changelog': '1.0.0',
      'workflows/workflow-missing-changelog-entry': '2.0.0',
      'workflows/wrong_location': '1.0.0',
    };
    const missingChangelogs = getMissingChangelogs(componentVersionMap);
    expect(missingChangelogs).toEqual([
      'actions/component-without-changelog',
      'actions/component-missing-changelog-entry',
      'workflows/workflow-without-changelog',
      'workflows/workflow-missing-changelog-entry',
      'workflows/wrong_location',
    ]);
  });

  it('should return an empty array when all changelogs are present and correct', () => {
    const componentVersionMap = {
      'actions/component-with-changelog': '1.0.0',
      'workflows/workflow-with-changelog': '2.0.0',
    };
    const missingChangelogs = getMissingChangelogs(componentVersionMap);
    expect(missingChangelogs).toEqual([]);
  });
});

describe('validate', () => {
  const scenarios = [
    {
      description: 'no labels are present',
      hasUntrackedLabel: false,
      hasInvalidLabels: false,
      hasComponentLabels: false,
      hasInvalidComponents: false,
      hasMissingChangelogs: false,
      expectedIsValid: false,
      expectedMessageFragment: '- No version labels',
    },
    {
      description: 'invalid labels are present',
      hasUntrackedLabel: false,
      hasInvalidLabels: true,
      hasComponentLabels: false,
      hasInvalidComponents: false,
      hasMissingChangelogs: false,
      expectedIsValid: false,
      expectedMessageFragment: '- Invalid version labels',
    },
    {
      description: 'conflicting untracked and component labels are present',
      hasUntrackedLabel: true,
      hasInvalidLabels: false,
      hasComponentLabels: true,
      hasInvalidComponents: false,
      hasMissingChangelogs: false,
      expectedIsValid: false,
      expectedMessageFragment: '- Conflicting version labels',
    },
    {
      description: 'invalid components are present',
      hasUntrackedLabel: false,
      hasInvalidLabels: false,
      hasComponentLabels: true,
      hasInvalidComponents: true,
      hasMissingChangelogs: false,
      expectedIsValid: false,
      expectedMessageFragment: '- Non-existent components',
    },
    {
      description: 'missing changelogs are present',
      hasUntrackedLabel: false,
      hasInvalidLabels: false,
      hasComponentLabels: true,
      hasInvalidComponents: false,
      hasMissingChangelogs: true,
      expectedIsValid: false,
      expectedMessageFragment: '- Missing or incomplete CHANGELOG.md entries',
    },
    {
      description: 'only valid component version labels are present',
      hasUntrackedLabel: false,
      hasInvalidLabels: false,
      hasComponentLabels: true,
      hasInvalidComponents: false,
      hasMissingChangelogs: false,
      expectedIsValid: true,
      expectedMessageFragment: 'Version validation passed',
    },
    {
      description: 'only untracked version label is present',
      hasUntrackedLabel: true,
      hasInvalidLabels: false,
      hasComponentLabels: false,
      hasInvalidComponents: false,
      hasMissingChangelogs: false,
      expectedIsValid: true,
      expectedMessageFragment: 'Version validation passed',
    },
  ];

  scenarios.push(
    {
      description: 'a component has more than one version label',
      hasUntrackedLabel: false,
      hasInvalidLabels: false,
      hasComponentLabels: true,
      hasInvalidComponents: false,
      hasMissingChangelogs: false,
      hasDuplicateComponents: true,
      expectedIsValid: false,
      expectedMessageFragment: '- More than one version label found for a component',
    },
    {
      description: 'a version is already released',
      hasUntrackedLabel: false,
      hasInvalidLabels: false,
      hasComponentLabels: true,
      hasInvalidComponents: false,
      hasMissingChangelogs: false,
      hasReleasedVersions: true,
      expectedIsValid: false,
      expectedMessageFragment: '- Versions that are already released',
    }
  );

  scenarios.forEach(scenario => {
    it(`should ${scenario.expectedIsValid ? 'pass' : 'fail'} when ${scenario.description}`, () => {
      const result = validate(
        scenario.hasInvalidLabels,
        scenario.hasComponentLabels,
        scenario.hasUntrackedLabel,
        scenario.hasInvalidComponents,
        scenario.hasMissingChangelogs,
        scenario.hasDuplicateComponents,
        scenario.hasReleasedVersions
      );
      expect(result.isValid).toBe(scenario.expectedIsValid);
      expect(result.validationMessage).toContain(scenario.expectedMessageFragment);
    });
  });
});

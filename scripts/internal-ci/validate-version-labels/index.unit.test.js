const {
  getLabelArray,
  getVersionLabelArray,
  getInvalidVersionLabels,
  getComponentVersionLabels,
  parseComponentVersionLabels,
  getInvalidComponents,
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
  `${versionLabelPrefix}valid/version/1.0.0`, // valid label
  'invalid-label', // completely invalid label
  `${versionLabelPrefix}/1.0.0`, // missing component info
  `${versionLabelPrefix}invalid/1.0.0`, // doesn't follow component-type/component-name format
  `${versionLabelPrefix}invalid/version`, // missing version
  `${versionLabelPrefix}invalid/version/1.0`, // not full semver
  `${versionLabelPrefix}invalid/version/1.0.0-extra`, // don't support build metadata
  `${versionLabelPrefix}invalid/version/v1.0.0`, // has 'v' prefix
];

describe('getInvalidVersionLabels', () => {
  it('should identify invalid version labels', () => {
    const invalidLabels = getInvalidVersionLabels(versionLabels);
    expect(invalidLabels).toEqual([
      `${versionLabelPrefix}`,
      'invalid-label',
      `${versionLabelPrefix}/1.0.0`,
      `${versionLabelPrefix}invalid/1.0.0`,
      `${versionLabelPrefix}invalid/version`,
      `${versionLabelPrefix}invalid/version/1.0`,
      `${versionLabelPrefix}invalid/version/1.0.0-extra`,
      `${versionLabelPrefix}invalid/version/v1.0.0`,
    ]);
  });
});

describe('getComponentVersionLabels', () => {
  it('should extract valid component version labels', () => {
    const componentLabels = getComponentVersionLabels(versionLabels);
    expect(componentLabels).toEqual([`${versionLabelPrefix}valid/version/1.0.0`]);
  });
});

/// It is assumed that component version labels are valid when this function is called
describe('parseComponentVersionLabels', () => {
  it('should parse component version labels into a map', () => {
    const componentLabels = [
      `${versionLabelPrefix}typeA/componentA/1.2.3`,
      `${versionLabelPrefix}typeA/componentB/2.3.4`,
    ];
    const componentVersionMap = parseComponentVersionLabels(componentLabels);
    expect(componentVersionMap).toEqual({
      'typeA/componentA': '1.2.3',
      'typeA/componentB': '2.3.4',
    });
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

  scenarios.forEach(scenario => {
    it(`should ${scenario.expectedIsValid ? 'pass' : 'fail'} when ${scenario.description}`, () => {
      const result = validate(
        scenario.hasInvalidLabels,
        scenario.hasComponentLabels,
        scenario.hasUntrackedLabel,
        scenario.hasInvalidComponents,
        scenario.hasMissingChangelogs
      );
      expect(result.isValid).toBe(scenario.expectedIsValid);
      expect(result.validationMessage).toContain(scenario.expectedMessageFragment);
    });
  });
});

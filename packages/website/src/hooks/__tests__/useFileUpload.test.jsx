import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useFileUpload from '../useFileUpload.jsx';

const { navigate, getProjects, uploadFileToBackend } = vi.hoisted(() => ({
  navigate: vi.fn(),
  getProjects: vi.fn(),
  uploadFileToBackend: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@lorax/core', () => ({
  useLorax: () => ({
    loraxSid: null,
    isConnected: false,
    getProjects,
    uploadFileToBackend,
  }),
}));

const SIZE_LIMIT = 25 * 1024 * 1024;

async function selectFile(result, source, file) {
  await act(async () => {
    if (source === 'input') {
      await result.current.onInputChange({ target: { files: file ? [file] : [] } });
    } else {
      await result.current.onDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: file ? [file] : [] },
      });
    }
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  uploadFileToBackend.mockResolvedValue({ status: 200, data: { filename: 'saved.trees' } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useFileUpload validation', () => {
  describe.each(['input', 'drop'])('%s selection', (source) => {
    it.each([
      { label: 'below', size: SIZE_LIMIT - 1 },
      { label: 'at', size: SIZE_LIMIT },
    ])('uploads files $label the 25 MB limit', async ({ size }) => {
      const { result } = renderHook(() => useFileUpload());
      const file = { name: 'sample.trees', size };

      await selectFile(result, source, file);

      expect(uploadFileToBackend).toHaveBeenCalledWith(file, expect.any(Function));
      expect(result.current.error).toBeNull();
      expect(result.current.isUploading).toBe(false);
      expect(navigate).toHaveBeenCalledWith('/view/saved.trees?project=Uploads');
    });

    it('rejects oversized files and preserves its input-clearing behavior', async () => {
      const { result } = renderHook(() => useFileUpload({ autoClearOnError: false }));
      const input = { value: 'selected.trees' };
      result.current.inputRef.current = input;

      await selectFile(result, source, { name: 'large.trees', size: SIZE_LIMIT + 1 });

      expect(result.current.error).toBe('File "large.trees" exceeds the 25 MB limit. For larger files, please use our Python CLI tool: `pip install lorax-arg`');
      expect(input.value).toBe(source === 'input' ? '' : 'selected.trees');
      expect(uploadFileToBackend).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('does nothing when no file is selected', async () => {
      const { result } = renderHook(() => useFileUpload());

      await selectFile(result, source, null);

      expect(uploadFileToBackend).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });
  });

  it('checks a dropped file extension before its size', async () => {
    const { result } = renderHook(() => useFileUpload());
    const input = { value: 'selected.trees' };
    result.current.inputRef.current = input;

    await selectFile(result, 'drop', { name: 'large.txt', size: SIZE_LIMIT + 1 });

    expect(result.current.error).toBe('File "large.txt" has an unsupported format. Supported formats: .trees, .tsz, .tszip, .csv');
    expect(input.value).toBe('selected.trees');
    expect(uploadFileToBackend).not.toHaveBeenCalled();
  });

  it('leaves extension filtering to the input accept attribute for input selections', async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = { name: 'sample.txt', size: 1 };

    await selectFile(result, 'input', file);

    expect(result.current.getInputProps().accept).toBe('.trees,.tsz,.tszip,.csv');
    expect(uploadFileToBackend).toHaveBeenCalledWith(file, expect.any(Function));
  });
});

describe('useFileUpload navigation', () => {
  it('uses the server filename and Uploads project after a successful upload', async () => {
    uploadFileToBackend.mockResolvedValue({
      status: 200,
      data: { filename: 'saved & tree#1.trees' },
    });
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.uploadFile({ name: 'original.trees', size: 1 });
    });

    expect(navigate).toHaveBeenCalledWith('/view/saved%20%26%20tree%231.trees?project=Uploads');
    expect(result.current.selectedFileName).toBe('original.trees');
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadStatus).toBe('loading inferred ARG....');
  });

  it.each([undefined, ''])('preserves the existing fallback for response filename %s', async (filename) => {
    // The existing success payload has no `name`, so the fallback remains undefined.
    uploadFileToBackend.mockResolvedValue({ status: 200, data: { filename } });
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.uploadFile({ name: 'original.trees', size: 1 });
    });

    expect(navigate).toHaveBeenCalledWith('/view/undefined?project=Uploads');
  });

  it.each([
    { shareSid: undefined, suffix: '' },
    { shareSid: '', suffix: '' },
    { shareSid: 'shared/id & 1', suffix: '&sid=shared%2Fid+%26+1' },
  ])('preserves project and optional sharing ID $shareSid for existing files', ({ shareSid, suffix }) => {
    const { result } = renderHook(() => useFileUpload());

    act(() => {
      result.current.loadFile({
        file: 'tree #1.trees',
        project: 'Project & One',
        share_sid: shareSid,
      });
    });

    expect(navigate).toHaveBeenCalledWith(`/view/tree%20%231.trees?project=Project+%26+One${suffix}`);
    expect(result.current.loadingFile).toBe('tree #1.trees');
    expect(uploadFileToBackend).not.toHaveBeenCalled();
  });

  it('does not navigate when no existing file is supplied', () => {
    const { result } = renderHook(() => useFileUpload());

    act(() => result.current.loadFile(null));

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.loadingFile).toBeNull();
  });
});

describe('useFileUpload request failures', () => {
  it.each([true, false])('respects autoClearOnError=%s and reports the original error', async (autoClearOnError) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = { response: { status: 400, data: { error: 'Invalid tree file' } } };
    uploadFileToBackend.mockRejectedValue(error);
    const onError = vi.fn();
    const { result } = renderHook(() => useFileUpload({ autoClearOnError, onError }));
    const input = { value: 'selected.trees' };
    result.current.inputRef.current = input;

    await selectFile(result, 'input', { name: 'sample.trees', size: 1 });

    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.error).toBe('Invalid tree file (HTTP 400)');
    expect(result.current.isUploading).toBe(false);
    expect(result.current.loadingFile).toBeNull();
    expect(input.value).toBe(autoClearOnError ? '' : 'selected.trees');
    expect(navigate).not.toHaveBeenCalled();
  });
});

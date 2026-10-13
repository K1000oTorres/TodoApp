import * as LZString from "lz-string";
import { defaultUser } from "../../constants/defaultUser";
import type { Category, Task, User, UUID } from "../../types/user";
import { getProfilePictureFromDB } from "../profilePictureStorage";
import { showToast } from "../showToast";
import {
  compressSyncData,
  decompressSyncData,
  extractOtherData,
  mergeSyncData,
  prepareSyncData,
} from "../syncUtils";

vi.mock("../profilePictureStorage", () => ({ getProfilePictureFromDB: vi.fn() }));
vi.mock("../showToast", () => ({ showToast: vi.fn() }));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as UUID;

const makeCategory = (n: number, overrides: Partial<Category> = {}): Category => ({
  id: uuid(100 + n),
  name: `Category ${n}`,
  color: "#ffffff",
  ...overrides,
});

const makeTask = (n: number, overrides: Partial<Task> = {}): Task => ({
  id: uuid(n),
  done: false,
  pinned: false,
  name: `Task ${n}`,
  color: "#000000",
  date: new Date(`2024-01-0${n}T10:00:00.000Z`),
  ...overrides,
});

interface DeviceData {
  tasks?: Task[];
  deletedTasks?: UUID[];
  categories?: Category[];
  deletedCategories?: UUID[];
  favoriteCategories?: UUID[];
  otherData?: Partial<User>;
}

const compressRemote = ({
  tasks = [],
  deletedTasks = [],
  categories = [],
  deletedCategories = [],
  favoriteCategories = [],
  otherData,
}: DeviceData) =>
  compressSyncData(
    prepareSyncData(
      tasks,
      deletedTasks,
      categories,
      deletedCategories,
      favoriteCategories,
      otherData,
    ),
  );

const merge = (
  local: DeviceData,
  remote: DeviceData,
  syncOption: Parameters<typeof mergeSyncData>[6] = "no_sync",
  localOtherData?: Partial<User>,
) =>
  mergeSyncData(
    local.tasks ?? [],
    local.deletedTasks ?? [],
    local.categories ?? [],
    local.deletedCategories ?? [],
    local.favoriteCategories ?? [],
    compressRemote(remote),
    syncOption,
    localOtherData,
  );

describe("syncUtils", () => {
  describe("prepareSyncData", () => {
    it("builds a version 1 payload from the given collections", () => {
      const tasks = [makeTask(1)];
      const categories = [makeCategory(1)];

      const data = prepareSyncData(tasks, [uuid(9)], categories, [uuid(109)], [uuid(101)]);

      expect(data).toMatchObject({
        version: 1,
        tasks,
        deletedTasks: [uuid(9)],
        categories,
        deletedCategories: [uuid(109)],
        favoriteCategories: [uuid(101)],
      });
      expect(data.lastModified).toBeInstanceOf(Date);
    });

    it("omits otherData when none is given", () => {
      expect(prepareSyncData([], [], [], [], [])).not.toHaveProperty("otherData");
    });

    it("includes otherData when given", () => {
      const data = prepareSyncData([], [], [], [], [], { name: "Ana" });

      expect(data.otherData).toEqual({ name: "Ana" });
    });
  });

  describe("compressSyncData / decompressSyncData", () => {
    it("round-trips sync data and restores dates", () => {
      const task = makeTask(1, {
        lastSave: new Date("2024-02-01T00:00:00.000Z"),
        deadline: new Date("2024-03-01T00:00:00.000Z"),
      });
      const data = prepareSyncData([task], [], [], [], []);

      const result = decompressSyncData(compressSyncData(data));

      expect(result?.lastModified).toEqual(data.lastModified);
      expect(result?.tasks[0].date).toEqual(task.date);
      expect(result?.tasks[0].lastSave).toEqual(task.lastSave);
      expect(result?.tasks[0].deadline).toEqual(task.deadline);
      expect(result?.tasks[0].name).toBe("Task 1");
    });

    it("returns null for an empty payload", () => {
      expect(decompressSyncData("")).toBeNull();
    });

    it("returns null for a payload that cannot be decompressed", () => {
      expect(decompressSyncData("not-a-valid-payload")).toBeNull();
    });

    it("returns null and logs when the payload is not valid sync data", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(decompressSyncData(LZString.compressToEncodedURIComponent("not json"))).toBeNull();
      expect(error).toHaveBeenCalled();

      error.mockRestore();
    });
  });

  describe("mergeSyncData", () => {
    describe("tasks", () => {
      it("keeps tasks that exist on only one device, ordered by creation date", () => {
        const result = merge(
          { tasks: [makeTask(3), makeTask(1)] },
          { tasks: [makeTask(2), makeTask(4)] },
        );

        expect(result.tasks.map((t) => t.name)).toEqual(["Task 1", "Task 2", "Task 3", "Task 4"]);
      });

      it("does not duplicate a task present on both devices", () => {
        const result = merge({ tasks: [makeTask(1)] }, { tasks: [makeTask(1)] });

        expect(result.tasks).toHaveLength(1);
      });

      it("keeps the remote version when it has the latest lastSave", () => {
        const local = makeTask(1, { name: "local", lastSave: new Date("2024-02-01T00:00:00Z") });
        const remote = makeTask(1, { name: "remote", lastSave: new Date("2024-03-01T00:00:00Z") });

        const result = merge({ tasks: [local] }, { tasks: [remote] });

        expect(result.tasks.map((t) => t.name)).toEqual(["remote"]);
      });

      it("keeps the local version when it has the latest lastSave", () => {
        const local = makeTask(1, { name: "local", lastSave: new Date("2024-03-01T00:00:00Z") });
        const remote = makeTask(1, { name: "remote", lastSave: new Date("2024-02-01T00:00:00Z") });

        const result = merge({ tasks: [local] }, { tasks: [remote] });

        expect(result.tasks.map((t) => t.name)).toEqual(["local"]);
      });

      it("treats a missing lastSave as the oldest version", () => {
        const local = makeTask(1, { name: "local" });
        const remote = makeTask(1, { name: "remote", lastSave: new Date("2024-03-01T00:00:00Z") });

        const result = merge({ tasks: [local] }, { tasks: [remote] });

        expect(result.tasks.map((t) => t.name)).toEqual(["remote"]);
      });

      it("prefers a version with lastSave over one without", () => {
        const local = makeTask(1, { name: "local", lastSave: new Date("2024-03-01T00:00:00Z") });
        const remote = makeTask(1, { name: "remote" });

        const result = merge({ tasks: [local] }, { tasks: [remote] });

        expect(result.tasks.map((t) => t.name)).toEqual(["local"]);
      });

      it("removes tasks deleted on the remote device", () => {
        const result = merge(
          { tasks: [makeTask(1), makeTask(2)] },
          { tasks: [], deletedTasks: [uuid(1)] },
        );

        expect(result.tasks.map((t) => t.name)).toEqual(["Task 2"]);
      });

      it("removes tasks deleted on the local device", () => {
        const result = merge(
          { tasks: [], deletedTasks: [uuid(2)] },
          { tasks: [makeTask(1), makeTask(2)] },
        );

        expect(result.tasks.map((t) => t.name)).toEqual(["Task 1"]);
      });

      it("returns the union of both deleted task lists without duplicates", () => {
        const result = merge(
          { deletedTasks: [uuid(1), uuid(2)] },
          { deletedTasks: [uuid(2), uuid(3)] },
        );

        expect([...result.deletedTasks].sort()).toEqual([uuid(1), uuid(2), uuid(3)]);
      });

      it("keeps the original order of tasks created at the same time", () => {
        const sameDate = new Date("2024-01-01T10:00:00.000Z");
        const result = merge(
          { tasks: [makeTask(1, { date: sameDate }), makeTask(2, { date: sameDate })] },
          { tasks: [makeTask(3, { date: sameDate })] },
        );

        expect(result.tasks.map((t) => t.name)).toEqual(["Task 1", "Task 2", "Task 3"]);
      });
    });

    describe("categories", () => {
      it("keeps categories from both devices", () => {
        const result = merge({ categories: [makeCategory(1)] }, { categories: [makeCategory(2)] });

        expect(result.categories.map((c) => c.name).sort()).toEqual(["Category 1", "Category 2"]);
      });

      it("keeps the version with the latest lastSave when both devices have the category", () => {
        const local = makeCategory(1, {
          name: "local",
          lastSave: new Date("2024-03-01T00:00:00Z"),
        });
        const remote = makeCategory(1, {
          name: "remote",
          lastSave: new Date("2024-02-01T00:00:00Z"),
        });

        const result = merge({ categories: [local] }, { categories: [remote] });

        expect(result.categories.map((c) => c.name)).toEqual(["local"]);
      });

      it("removes categories deleted on either device", () => {
        const result = merge(
          { categories: [makeCategory(1), makeCategory(2)], deletedCategories: [uuid(101)] },
          { categories: [makeCategory(3)], deletedCategories: [uuid(103)] },
        );

        expect(result.categories.map((c) => c.name)).toEqual(["Category 2"]);
        expect([...result.deletedCategories].sort()).toEqual([uuid(101), uuid(103)]);
      });

      it("sorts categories by lastSave, newest first, then by name", () => {
        const result = merge(
          {
            categories: [
              makeCategory(1, { name: "B", lastSave: new Date("2024-01-01T00:00:00Z") }),
              makeCategory(2, { name: "A" }),
            ],
          },
          {
            categories: [
              makeCategory(3, { name: "C", lastSave: new Date("2024-02-01T00:00:00Z") }),
              makeCategory(4, { name: "Z" }),
            ],
          },
        );

        expect(result.categories.map((c) => c.name)).toEqual(["C", "B", "A", "Z"]);
      });

      it("strips deleted categories from the tasks that reference them", () => {
        const kept = makeCategory(1);
        const removed = makeCategory(2);
        const result = merge(
          { tasks: [makeTask(1, { category: [kept, removed] })], categories: [kept, removed] },
          { deletedCategories: [removed.id] },
        );

        expect(result.tasks[0].category?.map((c) => c.id)).toEqual([kept.id]);
      });

      it("clears the task category list when every category was deleted", () => {
        const removed = makeCategory(2);
        const result = merge(
          { tasks: [makeTask(1, { category: [removed] })], categories: [removed] },
          { deletedCategories: [removed.id] },
        );

        expect(result.tasks[0].category).toBeUndefined();
      });
    });

    describe("favorite categories", () => {
      it("uses the favorite state of the device with the latest category change", () => {
        const category = makeCategory(1, { lastSave: new Date("2024-01-01T00:00:00Z") });
        const newerRemote = { ...category, lastSave: new Date("2024-02-01T00:00:00Z") };

        const result = merge(
          { categories: [category], favoriteCategories: [category.id] },
          { categories: [newerRemote], favoriteCategories: [] },
        );

        expect(result.favoriteCategories).toEqual([]);
      });

      it("keeps the local favorite when the local category is newer", () => {
        const category = makeCategory(1, { lastSave: new Date("2024-02-01T00:00:00Z") });
        const olderRemote = { ...category, lastSave: new Date("2024-01-01T00:00:00Z") };

        const result = merge(
          { categories: [category], favoriteCategories: [category.id] },
          { categories: [olderRemote], favoriteCategories: [] },
        );

        expect(result.favoriteCategories).toEqual([category.id]);
      });

      it("uses the remote favorite state for categories that only exist remotely", () => {
        const remoteOnly = makeCategory(1);

        const result = merge({}, { categories: [remoteOnly], favoriteCategories: [remoteOnly.id] });

        expect(result.favoriteCategories).toEqual([remoteOnly.id]);
      });

      it("drops the remote favorite of a category deleted on this device", () => {
        const category = makeCategory(1);

        const result = merge(
          { deletedCategories: [category.id] },
          { categories: [category], favoriteCategories: [category.id] },
        );

        expect(result.favoriteCategories).toEqual([]);
      });

      it("drops the local favorite of a category deleted on the other device", () => {
        const category = makeCategory(1);

        const result = merge(
          { categories: [category], favoriteCategories: [category.id] },
          { deletedCategories: [category.id] },
        );

        expect(result.favoriteCategories).toEqual([]);
      });
    });

    describe("other data", () => {
      const localOther = { name: "Local" };
      const remoteOther = { name: "Remote" };

      it("returns the local other data for this_device", () => {
        const result = merge({}, { otherData: remoteOther }, "this_device", localOther);

        expect(result.otherData).toEqual(localOther);
      });

      it("returns the remote other data for other_device", () => {
        const result = merge({}, { otherData: remoteOther }, "other_device", localOther);

        expect(result.otherData).toEqual(remoteOther);
      });

      it("returns no other data for no_sync", () => {
        const result = merge({}, { otherData: remoteOther }, "no_sync", localOther);

        expect(result).not.toHaveProperty("otherData");
      });
    });
  });

  describe("extractOtherData", () => {
    afterEach(() => {
      vi.mocked(getProfilePictureFromDB).mockReset();
      vi.mocked(showToast).mockReset();
    });

    it("excludes the emoji style and device specific settings", async () => {
      const result = await extractOtherData(defaultUser);

      expect(result).not.toHaveProperty("emojisStyle");
      expect(result.settings).not.toHaveProperty("appBadge");
      expect(result.settings).not.toHaveProperty("voice");
      expect(result.settings).not.toHaveProperty("voiceVolume");
      expect(result.settings).toHaveProperty("sortOption", defaultUser.settings.sortOption);
    });

    it("attaches the stored picture data for a local profile picture", async () => {
      vi.mocked(getProfilePictureFromDB).mockResolvedValue("data:image/png;base64,AAAA");

      const result = await extractOtherData({ ...defaultUser, profilePicture: "LOCAL_FILE_1" });

      expect(getProfilePictureFromDB).toHaveBeenCalledWith("LOCAL_FILE_1");
      expect(result.profilePictureData).toBe("data:image/png;base64,AAAA");
    });

    it("does not read the database for a remote profile picture", async () => {
      const result = await extractOtherData({
        ...defaultUser,
        profilePicture: "https://example.com/me.png",
      });

      expect(getProfilePictureFromDB).not.toHaveBeenCalled();
      expect(result).not.toHaveProperty("profilePictureData");
    });

    it("reports an error toast when the stored picture cannot be read", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(getProfilePictureFromDB).mockRejectedValue(new Error("db down"));

      const result = await extractOtherData({ ...defaultUser, profilePicture: "LOCAL_FILE_1" });

      expect(showToast).toHaveBeenCalledWith("Failed to get profile picture from DB", {
        type: "error",
      });
      expect(result).not.toHaveProperty("profilePictureData");

      error.mockRestore();
    });
  });
});

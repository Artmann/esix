import sinon from "sinon";

const databaseMock = {
  close: jest.fn(),
  db: jest.fn(),
};

jest.mock("mongodb");

import { connectionHandler } from "./connection-handler";

import { MongoClient } from "mongodb";

const sandbox = sinon.createSandbox();

describe("ConnectionHandler", () => {
  describe("getConnection", () => {
    beforeEach(() => {
      jest
        .mocked(MongoClient.connect)
        .mockImplementation(() => Promise.resolve(databaseMock) as any);
    });

    afterEach(() => {
      connectionHandler.closeConnections();
      sandbox.restore();
    });

    it("defaults to MongoClient as the adapter", async () => {
      await connectionHandler.getConnection();

      expect(MongoClient.connect).toHaveBeenCalled();
    });

    it("defaults hostname and max pool size", async () => {
      await connectionHandler.getConnection();

      expect(MongoClient.connect).toHaveBeenCalledWith(
        "mongodb://127.0.0.1:27017/",
        {
          maxPoolSize: 10,
        },
      );
    });

    it("can use a different url", async () => {
      sandbox.stub(process, "env").value({
        DB_URL: "mongodb://my-database.com/",
      });

      await connectionHandler.getConnection();

      expect(MongoClient.connect).toHaveBeenCalledWith(
        "mongodb://my-database.com/",
        {
          maxPoolSize: 10,
        },
      );
    });

    it("can use a different maximum pool size using the legacy env variable", async () => {
      sandbox.stub(process, "env").value({
        DB_POOL_SIZE: "42",
      });

      await connectionHandler.getConnection();

      expect(MongoClient.connect).toHaveBeenCalledWith(
        "mongodb://127.0.0.1:27017/",
        {
          maxPoolSize: 42,
        },
      );
    });

    it("can use a different maximum pool size", async () => {
      sandbox.stub(process, "env").value({
        DB_MAX_POOL_SIZE: "42",
      });

      await connectionHandler.getConnection();

      expect(MongoClient.connect).toHaveBeenCalledWith(
        "mongodb://127.0.0.1:27017/",
        {
          maxPoolSize: 42,
        },
      );
    });

    it("opens a database connection", async () => {
      sandbox.stub(process, "env").value({
        DB_DATABASE: "esix-testing",
      });

      await connectionHandler.getConnection();

      expect(MongoClient.connect).toHaveBeenCalled();
      expect(databaseMock.db).toHaveBeenCalledWith("esix-testing");
    });

    it("throws an errors for unkown adapters", async () => {
      sandbox.stub(process, "env").value({
        DB_ADAPTER: "mysql",
      });

      await expect(connectionHandler.getConnection()).rejects.toThrowError(
        `mysql is not a valid adapter name. Must be one of 'default', 'mock'.`,
      );
    });
  });

  describe("closeConnections", () => {
    it("closes the active connection", async () => {
      sandbox.stub(process, "env").value({
        DB_DATABASE: "esix-testing",
      });

      await connectionHandler.getConnection();

      await connectionHandler.closeConnections();

      expect(databaseMock.close).toHaveBeenCalled();
    });

    it("can be closed before opening a connection", async () => {
      await connectionHandler.closeConnections();
    });
  });
});

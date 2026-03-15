import { exec } from "child_process";
import { promisify } from "util";
import { EventData } from "./conflict";

const execAsync = promisify(exec);

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
}

export interface NetworkInfo {
  name: string;
  driver: string;
  scope: string;
  containers: string[];
}

class PortainerService {
  private dockerSocket = "/var/run/docker.sock";
  private portainerUrl = process.env.PORTAINER_URL || "http://localhost:9000";
  private portainerApiKey = process.env.PORTAINER_API_KEY || "";

  async listContainers(all = true): Promise<ContainerInfo[]> {
    try {
      const flags = all ? "-a" : "";
      const { stdout } = await execAsync(`docker ${flags} ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}"`);
      return stdout.trim().split("\n").filter(Boolean).map(line => {
        const [id, name, image, status, state, ports, created] = line.split("|");
        return { id, name, image, status, state, ports, created };
      });
    } catch (e) {
      console.error("[Portainer] List containers failed:", e);
      return [];
    }
  }

  async getContainer(idOrName: string): Promise<ContainerInfo | null> {
    try {
      const { stdout } = await execAsync(`docker inspect --format "{{.Id}}|{{.Name}}|{{.Image}}|{{.State.Status}}|{{.State.Running}}|{{.NetworkSettings.Ports}}" ${idOrName}`);
      const [id, name, image, status, running, ports] = stdout.trim().split("|");
      return {
        id,
        name: name.replace("/", ""),
        image,
        status,
        state: running === "true" ? "running" : "stopped",
        ports: ports || "",
        created: "",
      };
    } catch {
      return null;
    }
  }

  async startContainer(idOrName: string): Promise<boolean> {
    try {
      await execAsync(`docker start ${idOrName}`);
      return true;
    } catch (e) {
      console.error("[Portainer] Start failed:", e);
      return false;
    }
  }

  async stopContainer(idOrName: string): Promise<boolean> {
    try {
      await execAsync(`docker stop ${idOrName}`);
      return true;
    } catch (e) {
      console.error("[Portainer] Stop failed:", e);
      return false;
    }
  }

  async restartContainer(idOrName: string): Promise<boolean> {
    try {
      await execAsync(`docker restart ${idOrName}`);
      return true;
    } catch (e) {
      console.error("[Portainer] Restart failed:", e);
      return false;
    }
  }

  async removeContainer(idOrName: string, force = false): Promise<boolean> {
    try {
      const flag = force ? "-f" : "";
      await execAsync(`docker rm ${flag} ${idOrName}`);
      return true;
    } catch (e) {
      console.error("[Portainer] Remove failed:", e);
      return false;
    }
  }

  async getContainerLogs(idOrName: string, lines = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs --tail ${lines} ${idOrName}`);
      return stdout;
    } catch (e) {
      return `Error: ${e}`;
    }
  }

  async getContainerStats(idOrName: string): Promise<any> {
    try {
      const { stdout } = await execAsync(`docker stats --no-stream --format "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}" ${idOrName}`);
      const [cpu, mem, net, block] = stdout.trim().split("|");
      return { cpu, mem, net, block };
    } catch {
      return null;
    }
  }

  async listImages(): Promise<ImageInfo[]> {
    try {
      const { stdout } = await execAsync(`docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}"`);
      return stdout.trim().split("\n").filter(Boolean).map(line => {
        const [id, repository, tag, size, created] = line.split("|");
        return { id, repository, tag, size, created };
      });
    } catch {
      return [];
    }
  }

  async pullImage(imageName: string): Promise<boolean> {
    try {
      await execAsync(`docker pull ${imageName}`);
      return true;
    } catch (e) {
      console.error("[Portainer] Pull failed:", e);
      return false;
    }
  }

  async removeImage(imageName: string, force = false): Promise<boolean> {
    try {
      const flag = force ? "-f" : "";
      await execAsync(`docker rmi ${flag} ${imageName}`);
      return true;
    } catch {
      return false;
    }
  }

  async listVolumes(): Promise<VolumeInfo[]> {
    try {
      const { stdout } = await execAsync(`docker volume ls --format "{{.Name}}|{{.Driver}}|{{.Mountpoint}}"`);
      return stdout.trim().split("\n").filter(Boolean).map(line => {
        const [name, driver, mountpoint] = line.split("|");
        return { name, driver, mountpoint, created: "" };
      });
    } catch {
      return [];
    }
  }

  async listNetworks(): Promise<NetworkInfo[]> {
    try {
      const { stdout } = await execAsync(`docker network ls --format "{{.Name}}|{{.Driver}}|{{.Scope}}"`);
      return stdout.trim().split("\n").filter(Boolean).map(line => {
        const [name, driver, scope] = line.split("|");
        return { name, driver, scope, containers: [] };
      });
    } catch {
      return [];
    }
  }

  async runContainer(config: {
    name: string;
    image: string;
    ports?: string[];
    env?: string[];
    volumes?: string[];
    command?: string;
    detach?: boolean;
  }): Promise<string | null> {
    try {
      let cmd = "docker run";
      if (config.detach !== false) cmd += " -d";
      if (config.name) cmd += ` --name ${config.name}`;
      config.ports?.forEach(p => cmd += ` -p ${p}`);
      config.env?.forEach(e => cmd += ` -e ${e}`);
      config.volumes?.forEach(v => cmd += ` -v ${v}`);
      if (config.command) cmd += ` ${config.image} ${config.command}`;
      else cmd += ` ${config.image}`;

      const { stdout } = await execAsync(cmd);
      return stdout.trim();
    } catch (e) {
      console.error("[Portainer] Run failed:", e);
      return null;
    }
  }

  async createNetwork(name: string, driver = "bridge"): Promise<boolean> {
    try {
      await execAsync(`docker network create --driver ${driver} ${name}`);
      return true;
    } catch {
      return false;
    }
  }

  async getSystemInfo(): Promise<any> {
    try {
      const { stdout: version } = await execAsync("docker version --format '{{.Server.Version}}'");
      const { stdout: containers } = await execAsync("docker ps -a -q | wc -l");
      const { stdout: images } = await execAsync("docker images -q | wc -l");
      const { stdout: volumes } = await execAsync("docker volume ls -q | wc -l");
      const { stdout: networks } = await execAsync("docker network ls -q | wc -l");

      return {
        version: version.trim(),
        containers: parseInt(containers.trim()),
        images: parseInt(images.trim()),
        volumes: parseInt(volumes.trim()),
        networks: parseInt(networks.trim()),
      };
    } catch {
      return null;
    }
  }

  toEventData(containers: ContainerInfo[]): EventData[] {
    return containers.map(c => ({
      id: `container_${c.id}`,
      lat: 0,
      lon: 0,
      date: c.created || new Date().toISOString(),
      type: `[CONTAINER] ${c.name}`,
      description: `Image: ${c.image}\nStatus: ${c.status}\nState: ${c.state}\nPorts: ${c.ports || "none"}`,
      source: "Portainer",
      category: "cyber" as const,
      severity: c.state === "running" ? "low" : "medium" as const,
    }));
  }
}

export const portainerService = new PortainerService();

import ReactPlayer, { Config } from 'react-player';
import toWebVTT from 'srt-webvtt';
import { useEffect, useState } from 'react';
import { merge } from 'lodash';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Checkbox,
  Divider,
  Grid,
  GridItem,
  HStack,
  Heading,
  Stack,
  Text,
} from '@chakra-ui/react';
import { OnProgressProps } from 'react-player/base';
const fs = require('fs');

const DIR_PATH = `D:\\E-Learning\\AZ204\\AZ204 Developing Solutions for Microsoft Azure  NEW`;
const PROGRESS_FILE_PATH = `${DIR_PATH}\\progress.json`;

const loadProgress = () => {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE_PATH, 'utf8'));
  } catch (error) {
    return {
      currentVideoId: null,
      dict: {},
    };
  }
};

export function Video() {
  const [playingVideo, setPlayingVideo] = useState<any>(null);
  const [progress, setProgress] = useState<any>(loadProgress());

  const folders = fs.readdirSync(DIR_PATH) || [];
  const sections =
    (folders.map((folderName: string) => {
      const folderPath = `${DIR_PATH}\\${folderName}`;
      if (!fs.lstatSync(folderPath).isDirectory()) return;

      const files = fs.readdirSync(folderPath);
      const videos = files
        .filter((fileName: string) => fileName.endsWith('.mp4'))
        .map((fileName: string) => {
          const path = `${folderPath}\\${fileName}`;
          const srtPath = `${folderPath}\\${fileName.replace('.mp4', '.srt')}`;
          return {
            id: `${folderName}-${fileName}`,
            section: folderName,
            name: fileName.replace('.mp4', ''),
            path,
            srtPath,
          };
        });

      return {
        name: folderName,
        videos,
      };
    }) as any[]) || [];
  const videos = sections?.flatMap(
    (section: any) => section?.videos || []
  ) as any[];

  console.log("🚀 ~ file: Video.tsx:44 ~ Video ~ sections:", sections)


  const loadBlobFromPath = (path: string) => {
    const buffer = fs.readFileSync(path);
    return new Blob([buffer]);
  };

  const loadBlobUrlFromPath = (path: string) => {
    return URL.createObjectURL(loadBlobFromPath(path));
  };

  const updateProgress = (newProgress: any) => {
    const mergedProgress = merge(progress, newProgress);
    setProgress({ ...mergedProgress });
    fs.writeFileSync(PROGRESS_FILE_PATH, JSON.stringify(mergedProgress));
  };

  const playVideo = async (videoId: string) => {
    const video = videos.find((video: any) => video.id === videoId);
    const url = loadBlobUrlFromPath(video.path);
    const subtitleUrl = loadBlobFromPath(video.srtPath);
    const textTrackUrl = await toWebVTT(subtitleUrl);

    setPlayingVideo({
      url: url,
      config: {
        file: {
          tracks: [
            {
              kind: 'subtitles',
              src: textTrackUrl,
              srcLang: 'en',
              label: 'English',
              default: true,
              mode: 'showing',
            },
          ],
        },
      },
    });
    updateProgress({
      currentVideoId: videoId,
    });
  };

  const handleClickVideo = async (videoId: string) => {
    if (progress.currentVideoId === videoId) return;

    playVideo(videoId);
  };

  const setCheckVideo = (videoId: string, checked: boolean) => {
    updateProgress({
      dict: {
        [videoId]: {
          checked,
        },
      },
    });
  };

  const onVideoProgress = (state: OnProgressProps) => {
    // updateProgress({
    //   dict: {
    //     [progress.currentVideoId]: {
    //       playedSeconds: state.playedSeconds,
    //       loadedSeconds: state.loadedSeconds,
    //     },
    //   },
    // });

    if (state.loaded === 1 && state.loadedSeconds - state.playedSeconds <= 3) {
      setCheckVideo(progress.currentVideoId, true);
    }

    if (state.played === 1) {
      const nextIndex = videos.findIndex(
        (video: any) => video.id === progress.currentVideoId
      );
      if (nextIndex < videos.length - 1) {
        playVideo(videos[nextIndex + 1].id);
      }
    }
  };

  useEffect(() => {
    if (!playingVideo && !!progress?.currentVideoId) {
      playVideo(progress.currentVideoId);
    }
  }, [progress?.currentVideoId, playingVideo]);

  return (
    <div>
      <Grid w="100%" h="100vh" templateColumns="repeat(6, 1fr)" gap={4}>
        <GridItem colSpan={4} bg="papayawhip">
          {playingVideo && (
            <ReactPlayer
              onProgress={onVideoProgress}
              width="100%"
              height="100%"
              url={playingVideo?.url}
              controls
              playing
              config={playingVideo?.config}
            />
          )}
        </GridItem>
        <GridItem colSpan={2} overflowY="auto">
          <Accordion allowMultiple>
            {sections.map((section: any) => (
              <AccordionItem key={section?.name} bg="gray.300">
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    <Heading as="h3" size="sm">
                      {section?.name}
                    </Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel p={0}>
                  <Stack p={0} spacing={0} divider={<Divider />}>
                    {section?.videos.map((video: any) => (
                      <HStack
                        w="100%"
                        p={1}
                        key={video.name}
                        bg={
                          progress?.currentVideoId === video.id
                            ? 'teal.200'
                            : 'gray.100'
                        }
                      >
                        <Checkbox
                          isChecked={progress?.dict[video.id]?.checked}
                          onChange={(e) =>
                            setCheckVideo(video.id, e.target.checked)
                          }
                        />
                        <Box w={'100%'} cursor="pointer">
                          <Text onClick={() => handleClickVideo(video.id)}>
                            {video.name}
                          </Text>
                        </Box>
                      </HStack>
                    ))}
                  </Stack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </GridItem>
      </Grid>
    </div>
  );
}
